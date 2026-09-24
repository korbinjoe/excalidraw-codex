import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  exportToBlob,
  exportToSvg,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { applyPatch } from "./diagram";
import "./style.css";
window.EXCALIDRAW_ASSET_PATH = "/";
const token = new URLSearchParams(location.hash.slice(1)).get("token");
const client = crypto.randomUUID();
async function request(route, data) {
  const res = await fetch("/api/" + route, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify({ ...data, client }) : undefined,
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error);
  return result;
}
const serial = (elements, appState, files) => ({
  elements,
  appState: {
    viewBackgroundColor: appState.viewBackgroundColor,
    gridSize: appState.gridSize ?? null,
  },
  files,
});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function Canvas() {
  const [initial, setInitial] = useState(null),
    [api, setApi] = useState(null),
    [status, setStatus] = useState("Connecting…"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [theme, setTheme] = useState(
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
  const model = useRef({
    revision: 0,
    last: "",
    dirty: null,
    timer: null,
    saving: Promise.resolve(),
    queue: Promise.resolve(),
    suppress: false,
    inflight: false,
    pointer: false,
    error: "",
    api: null,
    boot: null,
  });
  const m = model.current;
  const fail = (e) => {
    m.error = e.message;
    setError(e.message);
    setStatus("Not saved");
  };
  function sceneNow() {
    return serial(
      m.api.getSceneElementsIncludingDeleted(),
      m.api.getAppState(),
      m.api.getFiles(),
    );
  }
  function flush() {
    clearTimeout(m.timer);
    m.saving = m.saving
      .catch(() => {})
      .then(async () => {
        if (m.error) throw new Error(m.error);
        if (!m.dirty) return;
        const scene = m.dirty;
        m.dirty = null;
        m.inflight = true;
        try {
          const result = await request("save", {
            scene,
            baseRevision: m.revision,
          });
          m.revision = result.revision;
          m.last = JSON.stringify(scene);
          setStatus(m.dirty ? "Saving…" : "Saved");
        } catch (e) {
          if (!m.dirty) m.dirty = scene;
          fail(e);
          throw e;
        } finally {
          m.inflight = false;
        }
      });
    return m.saving;
  }
  function changed(elements, state, files) {
    setTheme(state.theme || theme);
    if (m.suppress || !m.api) return;
    const scene = serial(elements, state, files),
      value = JSON.stringify(scene);
    if (value === m.last && !m.dirty) return;
    m.dirty = scene;
    setStatus("Saving…");
    clearTimeout(m.timer);
    m.timer = setTimeout(() => flush().catch(() => {}), 250);
  }
  async function execute(event) {
    if (m.error) throw new Error(m.error);
    for (
      let i = 0;
      i < 150 && (m.pointer || m.api.getAppState().editingTextElement);
      i++
    )
      await delay(100);
    if (m.pointer || m.api.getAppState().editingTextElement)
      throw new Error("Finish dragging or editing text before asking Codex to make changes.");
    await flush();
    if (
      event.expectedRevision !== undefined &&
      event.expectedRevision !== m.revision
    )
      throw new Error("The canvas has manual edits. Read the latest scene before making changes.");
    setBusy(true);
    setStatus("Codex is drawing…");
    try {
      const cmd = event.command;
      if (cmd.type === "apply") {
        const elements = applyPatch(
          m.api.getSceneElementsIncludingDeleted(),
          cmd,
        );
        m.suppress = true;
        m.api.updateScene({
          elements,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        await new Promise(requestAnimationFrame);
        m.suppress = false;
        m.dirty = sceneNow();
        await flush();
        if (cmd.fit)
          m.api.scrollToContent(undefined, {
            fitToContent: true,
            animate: true,
          });
        return {
          ok: true,
          elementCount: elements.filter((e) => !e.isDeleted).length,
        };
      }
      if (cmd.type === "fit") {
        m.api.scrollToContent(undefined, { fitToContent: true, animate: true });
        return { ok: true };
      }
      if (cmd.type === "export") {
        await document.fonts.ready;
        const options = {
          elements: m.api.getSceneElements(),
          appState: {
            ...m.api.getAppState(),
            exportWithDarkMode: false,
            exportBackground: true,
          },
          files: m.api.getFiles(),
          exportPadding: 32,
        };
        const blob =
          cmd.format === "svg"
            ? new Blob([(await exportToSvg(options)).outerHTML], {
                type: "image/svg+xml",
              })
            : await exportToBlob({ ...options, mimeType: "image/png" });
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return { format: cmd.format, data };
      }
      throw new Error("Unknown canvas command");
    } finally {
      m.suppress = false;
      setBusy(false);
      if (!m.error) setStatus("Saved");
    }
  }
  useEffect(() => {
    request("state")
      .then((state) => {
        m.revision = state.revision;
        m.boot = state.boot;
        m.last = JSON.stringify(state.scene);
        setInitial(state);
        document.title = state.file.split("/").pop() + " · Excalidraw";
      })
      .catch(fail);
    return () => clearTimeout(m.timer);
  }, []);
  useEffect(() => {
    if (!api || !initial) return;
    m.api = api;
    const events = new EventSource(
      "/api/events?token=" + token + "&client=" + client,
    );
    events.onopen = () => {
      setConnected(true);
      setStatus(m.dirty ? "Saving…" : "Saved");
    };
    events.onerror = () => {
      setConnected(false);
      setStatus("Disconnected · Reconnecting");
    };
    events.onmessage = ({ data }) => {
      const event = JSON.parse(data);
      if (event.type === "state") {
        if (event.client === client) return;
        if (event.boot && event.boot !== m.boot) {
          fail(new Error("The service restarted. Reopen this canvas."));
          return;
        }
        if (event.revision <= m.revision) return;
        if (
          m.dirty ||
          m.inflight ||
          m.pointer ||
          m.api.getAppState().editingTextElement
        ) {
          fail(
            new Error(
              "Another panel updated this canvas. Download a copy of your edits before reloading.",
            ),
          );
          return;
        }
        m.suppress = true;
        m.revision = event.revision;
        m.last = JSON.stringify(event.scene);
        m.api.addFiles(Object.values(event.scene.files || {}));
        m.api.updateScene({
          ...event.scene,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        requestAnimationFrame(() => {
          m.suppress = false;
        });
        return;
      }
      if (event.type === "command")
        m.queue = m.queue
          .catch(() => {})
          .then(async () => {
            try {
              const result = await execute(event);
              await request("result", { id: event.id, result });
            } catch (e) {
              await request("result", { id: event.id, error: e.message }).catch(
                () => {},
              );
            }
          });
    };
    const beforeUnload = (e) => {
      if (m.dirty || m.inflight || m.error) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      events.close();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [api, initial]);
  async function exportImage() {
    try {
      const { data } = await execute({
        command: { type: "export", format: "png" },
      });
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      download(
        new Blob([bytes], { type: "image/png" }),
        initial.file.split("/").pop().replace(".excalidraw", ".png"),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  async function reload() {
    try {
      await request("reload", {});
      location.reload();
    } catch (e) {
      fail(e);
    }
  }
  if (!initial)
    return <div className="loading">{error || "Opening canvas…"}</div>;
  return (
    <div className={"shell " + theme}>
      <header className="topbar">
        <div className="identity">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="5"
              width="13"
              height="14"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.7"
              transform="rotate(-8 9 12)"
            />
            <path d="m12 14 7-8 2 2-7 8-3 1 1-3Z" fill="currentColor" />
          </svg>
          <div className="filename" title={initial.file}>
            {initial.file.split("/").pop().replace(".excalidraw", "")}
          </div>
        </div>
        <div className="actions">
          <span
            className={"status " + (connected ? "online" : "offline")}
            role="status"
          >
            <i />
            {busy ? "Drawing" : status}
          </span>
          <button
            title="Fit to content"
            aria-label="Fit to content"
            onClick={() =>
              api.scrollToContent(undefined, {
                fitToContent: true,
                animate: true,
              })
            }
          >
            ⊡
          </button>
          <button onClick={exportImage} disabled={busy}>
            Export PNG
          </button>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          <span>{error}</span>
          <button
            onClick={() =>
              download(
                new Blob(
                  [
                    JSON.stringify({
                      type: "excalidraw",
                      version: 2,
                      ...(m.dirty || sceneNow()),
                    }),
                  ],
                  { type: "application/json" },
                ),
                "recovery.excalidraw",
              )
            }
          >
            Download a copy
          </button>
          <button onClick={reload}>Reload</button>
        </div>
      )}
      <main className={busy ? "busy" : ""}>
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={{
            ...initial.scene,
            scrollToContent: true,
            appState: { ...initial.scene.appState, theme },
          }}
          langCode="en"
          theme={theme}
          onChange={changed}
          onPointerDown={() => {
            m.pointer = true;
          }}
          onPointerUp={() => {
            m.pointer = false;
          }}
          UIOptions={{
            canvasActions: { loadScene: false, saveToActiveFile: false },
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Heading>
                Draw your ideas
              </WelcomeScreen.Center.Heading>
              <WelcomeScreen.Center.Menu>
                <div className="welcome-copy">
                  Tell Codex what you want to draw,
                  <br />
                  or start drawing here.
                </div>
              </WelcomeScreen.Center.Menu>
            </WelcomeScreen.Center>
          </WelcomeScreen>
        </Excalidraw>
      </main>
      <footer>
        <span>Describe it · Edit it</span>
        <span title={initial.file}>Saved to a local file</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Canvas />);
