# Runtime and development

The plugin ships a built frontend (`dist/`) and dependency-free Node runtime (`runtime/`, `scripts/canvas.mjs`). Normal use does not run npm or download packages. All editor assets/fonts are served locally.

Each canonical absolute file path maps to a session directory under `~/.local/state/codex-excalidraw-canvas`. `session.json` records its local origin, process, and capability token. Do not expose that token outside local panel URLs. The server binds only 127.0.0.1; API calls require the token and reject foreign origins. Each process can access only its registered scene through the API. Scenes are not sent to third-party services by this plugin.

The browser uses server-sent events for commands and scene updates. Apply operations run through the official Excalidraw normalization/rendering APIs in the open panel, then await an atomic save before acknowledging completion. Revision checks prevent a stale client from replacing a newer scene. Browser hand edits are debounced for 250 ms. PNG/SVG exports run in the same editor. Starting an existing session does not create a second process. Ports are assigned dynamically.

`server.log` in the session directory records startup/runtime failures. If `open` fails, read only the session log for the chosen file. Do not remove unrelated sessions. Use `EXCALIDRAW_CANVAS_STATE` to isolate tests.

Maintain source in `~/work/excalidraw-codex`. Run `npm ci` when dependencies are missing, then `npm run codex:update` after changes. This tests, builds, validates, generates the marketplace package under `.codex-build/excalidraw-codex` inside that repository, reinstalls through Codex, and verifies the installed files. The build copies Excalidraw fonts to dist. Existing canvas processes retain their old backend: confirm saved state and stop/reopen the relevant canvas to test runtime changes. Do not restart unrelated canvases. Existing tasks may need a new task to discover the installed skill; an already-open browser can continue to use its current runtime.
