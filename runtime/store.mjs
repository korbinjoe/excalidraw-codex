import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  try {
    const fd = fs.openSync(temp, "wx", 0o600);
    try {
      fs.writeFileSync(fd, value);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
export function validateScene(scene) {
  if (!scene || !Array.isArray(scene.elements) || scene.elements.length > 30000)
    throw new Error(
      "Invalid scene: elements must be an array (maximum 30000).",
    );
  const ids = new Set();
  for (const el of scene.elements) {
    if (!el || typeof el.id !== "string" || !el.id || ids.has(el.id))
      throw new Error("Invalid or duplicate element ID.");
    if (
      typeof el.type !== "string" ||
      !Number.isFinite(el.x) ||
      !Number.isFinite(el.y)
    )
      throw new Error("Invalid element coordinates/type.");
    ids.add(el.id);
  }
  return {
    type: "excalidraw",
    version: 2,
    source: "excalidraw-codex",
    elements: scene.elements,
    appState: {
      viewBackgroundColor: scene.appState?.viewBackgroundColor || "#ffffff",
      gridSize: scene.appState?.gridSize ?? null,
    },
    files: scene.files || {},
  };
}
export class Store {
  constructor(file, historyDir) {
    this.file = file;
    this.historyDir = historyDir;
    this.revision = 0;
    fs.mkdirSync(historyDir, { recursive: true, mode: 0o700 });
    this.load();
  }
  load() {
    if (fs.existsSync(this.file)) {
      const raw = fs.readFileSync(this.file, "utf8");
      this.scene = validateScene(JSON.parse(raw));
      this.diskHash = digest(raw);
    } else {
      this.scene = validateScene({ elements: [] });
      const raw = JSON.stringify(this.scene, null, 2) + "\n";
      atomicWrite(this.file, raw);
      this.diskHash = digest(raw);
    }
    this.revision++;
    return this.state();
  }
  state() {
    return { revision: this.revision, file: this.file, scene: this.scene };
  }
  commit(scene, baseRevision) {
    if (baseRevision !== this.revision)
      throw Object.assign(new Error("The canvas has changed. Read the latest scene before making changes."), {
        status: 409,
      });
    if (
      !fs.existsSync(this.file) ||
      digest(fs.readFileSync(this.file)) !== this.diskHash
    )
      throw Object.assign(
        new Error(
          "Another program changed the file. Your edits remain in the browser. Download a copy before reloading.",
        ),
        { status: 409 },
      );
    const next = validateScene(scene),
      raw = JSON.stringify(next, null, 2) + "\n";
    if (digest(raw) === this.diskHash) return this.state();
    atomicWrite(
      path.join(this.historyDir, `${Date.now()}-${this.revision}.excalidraw`),
      JSON.stringify(this.scene, null, 2) + "\n",
    );
    atomicWrite(this.file, raw);
    this.scene = next;
    this.diskHash = digest(raw);
    this.revision++;
    const history = fs
      .readdirSync(this.historyDir)
      .filter((f) => f.endsWith(".excalidraw"))
      .sort();
    for (const f of history.slice(0, -30))
      fs.unlinkSync(path.join(this.historyDir, f));
    return this.state();
  }
}
