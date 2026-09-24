# excalidraw-codex maintenance

- The only maintenance repository is `~/work/excalidraw-codex`. Do not maintain a copy under `~/plugins` or edit the Codex installation cache.
- After requested changes, run `npm run codex:update`. It tests and builds, generates `.codex-build/excalidraw-codex` inside this repository, validates it, applies the plugin-creator cachebuster helper, installs it through `codex plugin add`, and verifies every installed file.
- `.codex-build/` is a disposable ignored build output, not another source tree. The personal marketplace references that generated package. Codex keeps its own required runtime copy under `~/.codex/plugins/cache/`.
- Use `npm ci` when dependencies are missing. Keep node_modules, Git metadata, release archives, examples, and local deployment state out of the generated package.
- Keep the source manifest's base version intentional. The generated/installed manifest receives the automatic `+codex.<timestamp>` suffix.
- `npm run codex:register` explicitly registers or relocates this repository's personal marketplace entry (create, relocate, or explicitly rename with `--rename-from`), backing up the catalog and preserving unrelated entries. Normal updates never rewrite marketplace.json or Codex config.
- New Codex tasks load the updated skill. Running canvas servers retain their old backend until stopped and reopened; verify saved state first and do not interrupt unrelated canvases.

- Use `excalidraw-codex` as the public plugin, package, and Skill name. Keep the legacy runtime state namespace for existing sessions and history.
- Write source, UI strings, comments, tests, examples, and contributor documentation in English. Chinese is reserved for `README.zh-CN.md` and the README language switch. Do not translate user-owned drawings, third-party license notices, or generated dependency assets.

- README showcases should use real Excalidraw exports with handwritten typography and a representative multi-step flowchart or architecture diagram. Keep an editable scene alongside the image and check label legibility, grouping, and connector routing before publishing.
