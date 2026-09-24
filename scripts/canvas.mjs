#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2),
  command = args.shift() || "help";
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(session, route, data) {
  const res = await fetch(session.origin + route, {
    method: data ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(35000),
  });
  const result = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(result.error || `HTTP ${res.status}`), {
      code: result.code,
    });
  return result;
}
async function connect(file) {
  // Preserve the pre-rename namespace so active sessions and history remain discoverable.
  const dir = path.join(
    process.env.EXCALIDRAW_CANVAS_STATE ||
      path.join(os.homedir(), ".local", "state", "codex-excalidraw-canvas"),
    crypto.createHash("sha256").update(file).digest("hex").slice(0, 24),
  );
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const sessionFile = path.join(dir, "session.json"),
    lock = path.join(dir, "starting");
  const existing = async () => {
    try {
      const s = JSON.parse(fs.readFileSync(sessionFile));
      const state = await request(s, "/api/state");
      if (state.file === file && state.boot === s.boot) return s;
    } catch {}
    return null;
  };
  const prior = await existing();
  if (prior) return prior;
  let locked = false;
  for (let i = 0; i < 100; i++) {
    try {
      fs.mkdirSync(lock);
      locked = true;
      break;
    } catch {
      const s = await existing();
      if (s) return s;
      if (Date.now() - fs.statSync(lock).mtimeMs > 20000) {
        fs.rmSync(lock, { recursive: true, force: true });
      }
      await sleep(100);
    }
  }
  if (!locked) throw new Error("Canvas startup is busy. Retry open.");
  try {
    const s = await existing();
    if (s) return s;
    if (!fs.existsSync(path.join(root, "dist", "index.html")))
      throw new Error(
        "Missing packaged editor. Build this plugin before installing it.",
      );
    const log = fs.openSync(path.join(dir, "server.log"), "a");
    const child = spawn(
      process.execPath,
      [path.join(root, "runtime", "server.mjs"), file, dir],
      { detached: true, stdio: ["ignore", log, log] },
    );
    child.unref();
    fs.closeSync(log);
    for (let i = 0; i < 80; i++) {
      await sleep(100);
      const s = await existing();
      if (s) return s;
    }
    throw new Error(
      `Canvas failed to start. Inspect ${path.join(dir, "server.log")}`,
    );
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}
try {
  if (command === "help") {
    console.log(
      "canvas.mjs open|read|apply|fit|export|stop --file /absolute/diagram.excalidraw [--input patch.json] [--out image.png|image.svg] [--revision N]\napply reads JSON from --input or stdin. open returns the URL to open in Codex placement:right.",
    );
    process.exit(0);
  }
  let file = option("--file");
  if (!file || !path.isAbsolute(file) || !file.endsWith(".excalidraw"))
    throw new Error("--file must be an absolute .excalidraw path.");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  file = fs.existsSync(file)
    ? fs.realpathSync(file)
    : path.join(fs.realpathSync(path.dirname(file)), path.basename(file));
  const s = await connect(file);
  if (command === "stop") {
    process.kill(s.pid, "SIGTERM");
    console.log(JSON.stringify({ stopped: true, file }));
    process.exit(0);
  }
  if (command === "open") {
    console.log(
      JSON.stringify({
        file,
        url: `${s.origin}/#token=${s.token}`,
        placement: "right",
        reused: true,
      }),
    );
    process.exit(0);
  }
  if (command === "read") {
    const state = await request(s, "/api/state");
    const elements = state.scene.elements.filter((e) => !e.isDeleted);
    console.log(
      JSON.stringify({
        file,
        revision: state.revision,
        panelConnected: state.clients > 0,
        elements: args.includes("--full")
          ? elements
          : elements.map((e) => ({
              id: e.id,
              type: e.type,
              text: e.text,
              x: e.x,
              y: e.y,
              width: e.width,
              height: e.height,
              containerId: e.containerId,
              startBinding: e.startBinding,
              endBinding: e.endBinding,
            })),
        ...(args.includes("--full") ? { scene: state.scene } : {}),
      }),
    );
    process.exit(0);
  }
  let action;
  if (command === "apply") {
    const input = option("--input");
    const patch = JSON.parse(fs.readFileSync(input || 0, "utf8"));
    action = { type: "apply", ...patch };
  } else if (command === "fit") action = { type: "fit" };
  else if (command === "export") {
    const out = option("--out");
    if (
      !out ||
      !path.isAbsolute(out) ||
      ![".png", ".svg"].includes(path.extname(out))
    )
      throw new Error("--out must be an absolute .png or .svg path.");
    action = { type: "export", format: path.extname(out).slice(1) };
  } else throw new Error("Unknown command: " + command);
  const result = await request(s, "/api/command", {
    id: crypto.randomUUID(),
    command: action,
    expectedRevision:
      option("--revision") === undefined
        ? undefined
        : Number(option("--revision")),
  });
  if (command === "export") {
    const out = option("--out");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(result.data, "base64"));
    delete result.data;
    result.path = out;
  }
  console.log(JSON.stringify(result));
} catch (e) {
  console.error(
    JSON.stringify({ error: e.message, ...(e.code ? { code: e.code } : {}) }),
  );
  process.exit(1);
}
