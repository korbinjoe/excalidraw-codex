import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
const serverPath = fileURLToPath(
  new URL("../runtime/server.mjs", import.meta.url),
);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function launch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excalidraw-http-")),
    file = path.join(dir, "scene.excalidraw"),
    sessionDir = path.join(dir, "session");
  fs.mkdirSync(sessionDir);
  const child = spawn(process.execPath, [serverPath, file, sessionDir], {
    stdio: "ignore",
  });
  t.after(async () => {
    child.kill();
    await once(child, "exit");
    fs.rmSync(dir, { recursive: true, force: true });
  });
  for (let i = 0; i < 100; i++) {
    try {
      const s = JSON.parse(
        fs.readFileSync(path.join(sessionDir, "session.json")),
      );
      return { ...s, dir };
    } catch {
      await pause(20);
    }
  }
  throw new Error("Server did not start");
}
test("HTTP API requires a token and refuses foreign origins", async (t) => {
  const s = await launch(t);
  assert.equal((await fetch(s.origin + "/api/state")).status, 401);
  assert.equal(
    (
      await fetch(s.origin + "/api/state", {
        headers: {
          Authorization: `Bearer ${s.token}`,
          Origin: "https://example.com",
        },
      })
    ).status,
    403,
  );
  const state = await (
    await fetch(s.origin + "/api/state", {
      headers: { Authorization: `Bearer ${s.token}` },
    })
  ).json();
  assert.equal(state.file, s.file);
});
test("unopened panel returns a useful error, and invalid writes cannot corrupt the file", async (t) => {
  const s = await launch(t),
    headers = {
      Authorization: `Bearer ${s.token}`,
      "Content-Type": "application/json",
    };
  const r = await fetch(s.origin + "/api/command", {
    method: "POST",
    headers,
    body: JSON.stringify({ command: { type: "apply" } }),
  });
  assert.equal(r.status, 409);
  assert.equal((await r.json()).code, "PANEL_REQUIRED");
  const r2 = await fetch(s.origin + "/api/save", {
    method: "POST",
    headers,
    body: JSON.stringify({
      baseRevision: 1,
      scene: { elements: [{ id: "bad" }] },
    }),
  });
  assert.equal(r2.status, 400);
  assert.equal(JSON.parse(fs.readFileSync(s.file)).elements.length, 0);
});
