import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../runtime/store.mjs";
const el = (id) => ({
  id,
  type: "rectangle",
  x: 10,
  y: 20,
  width: 160,
  height: 80,
});
function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "excalidraw-store-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return {
    file: path.join(dir, "scene.excalidraw"),
    history: path.join(dir, "history"),
  };
}
test("atomic save survives restart with editable labels, images and bindings", (t) => {
  const { file, history } = setup(t),
    s = new Store(file, history),
    scene = {
      elements: [
        el("a"),
        { ...el("label"), type: "text", text: "Hello", containerId: "a" },
      ],
      files: { image: { id: "image", dataURL: "data:image/png;base64,a" } },
    };
  s.commit(scene, s.revision);
  const restored = new Store(file, history);
  assert.deepEqual(restored.scene.elements, scene.elements);
  assert.deepEqual(restored.scene.files, scene.files);
  assert.equal(fs.readdirSync(history).length, 1);
});
test("stale edits cannot overwrite a newer revision", (t) => {
  const { file, history } = setup(t),
    s = new Store(file, history),
    rev = s.revision;
  s.commit({ elements: [el("a")] }, rev);
  assert.throws(() => s.commit({ elements: [el("b")] }, rev), { status: 409 });
  assert.equal(JSON.parse(fs.readFileSync(file)).elements[0].id, "a");
});
test("external file modifications are detected and preserved", (t) => {
  const { file, history } = setup(t),
    s = new Store(file, history);
  const external = JSON.stringify({ elements: [el("external")] });
  fs.writeFileSync(file, external);
  assert.throws(() => s.commit({ elements: [el("agent")] }, s.revision), {
    status: 409,
  });
  assert.equal(fs.readFileSync(file, "utf8"), external);
  assert.equal(s.load().scene.elements[0].id, "external");
});
test("invalid scenes never replace valid saved content", (t) => {
  const { file, history } = setup(t),
    s = new Store(file, history),
    before = fs.readFileSync(file, "utf8");
  assert.throws(() => s.commit({ elements: [el("a"), el("a")] }, s.revision));
  assert.equal(fs.readFileSync(file, "utf8"), before);
});
test("two file sessions stay isolated", (t) => {
  const { file, history } = setup(t),
    a = new Store(file, history),
    b = new Store(file + ".excalidraw", history + "2");
  a.commit({ elements: [el("a")] }, a.revision);
  assert.equal(b.scene.elements.length, 0);
});
test("history retains the most recent 30 prior scenes", (t) => {
  const { file, history } = setup(t),
    s = new Store(file, history);
  for (let i = 0; i < 35; i++)
    s.commit({ elements: [el("e" + i)] }, s.revision);
  assert.equal(fs.readdirSync(history).length, 30);
});
