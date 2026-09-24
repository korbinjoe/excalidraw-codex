import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = "excalidraw-codex",
  stage = fs.mkdtempSync(path.join(os.tmpdir(), name + "-release-")),
  plugin = path.join(stage, name);
fs.mkdirSync(plugin);
for (const entry of [
  ".codex-plugin",
  "skills",
  "runtime",
  "dist",
  "assets",
  "README.md",
  "README.zh-CN.md",
  "CONTRIBUTING.md",
  "docs",
  "LICENSE",
  "THIRD_PARTY_NOTICES.txt",
])
  fs.cpSync(path.join(root, entry), path.join(plugin, entry), {
    recursive: true,
  });
fs.mkdirSync(path.join(plugin, "scripts"));
fs.copyFileSync(
  path.join(root, "scripts/canvas.mjs"),
  path.join(plugin, "scripts/canvas.mjs"),
);
const version = JSON.parse(
  fs.readFileSync(path.join(root, ".codex-plugin/plugin.json")),
).version;
const out = path.join(root, "release", `${name}-${version}.zip`);
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync("/usr/bin/zip", ["-q", "-r", out, name], { cwd: stage });
fs.rmSync(stage, { recursive: true, force: true });
console.log(out);
