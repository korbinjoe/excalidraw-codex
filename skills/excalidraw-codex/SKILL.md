---
name: excalidraw-codex
description: Create and edit real Excalidraw diagrams through conversation, with a live editable canvas in the Codex right-side browser panel and automatic local file saving. Use when the user requests Excalidraw, hand-drawn flowcharts, or an editable diagram linked to the Codex panel.
---

# excalidraw-codex

Use the bundled local editor to keep the conversation and the editable diagram together. It uses the official Excalidraw editor. No account, API key, npm installation, or external service is needed at runtime; Node.js 20+ is required.

## Open the right panel first

1. Resolve the installed plugin root as **two directories above this SKILL.md**. Do not hardcode the source directory, a cache version, or a port. The executable is `<plugin-root>/scripts/canvas.mjs`.
2. Pick one absolute `.excalidraw` file in the current workspace, normally `diagrams/<descriptive-name>.excalidraw`. Use the file already established in this conversation for follow-up edits. An existing file is opened without being cleared. Different file paths have independent sessions.
3. Run `node "<plugin-root>/scripts/canvas.mjs" open --file "<absolute-file>"`. Parse its `url`. The server starts itself and stays running after the shell command exits.
4. Open that exact URL in the **current task's right-side browser panel** with the available `open_in_codex` tool:
   ```json
   {"placement":"right","target":{"type":"browser","url":"<returned-url>"}}
   ```
   If a matching browser tab is already known, reuse its `tabId` instead of creating another tab. On subsequent drawing turns, `read` reports `panelConnected`; keep the current tab when true. When browser tools are available, get the tab by the returned URL, call `markDeliverable()` so it survives the turn, and inspect it. Do not switch to an external browser when the right panel is available.
5. Run `read`. If `panelConnected` is false, wait briefly and recheck once; inspect the browser's page/error state before retrying. A queued panel open is not proof the editor connected. In a client without an in-app browser, provide the URL and accurately explain that the integrated preview is unavailable there.

This is a skill-backed plugin using the app's supported browser panel, not a custom native Codex editor extension. Never claim public marketplace approval or native widget support.

## Draw and refine

Commands take `--file` each time. Use JSON files or a quoted heredoc; never interpolate user text into shell code.

- `read [--full]`: current saved revision and element IDs, labels, positions, and bindings; `--full` also returns the complete scene.
- `apply --input <patch.json> [--revision N]`: create/update/delete elements in one undoable operation. Omitting `--input` reads JSON from stdin. Prefer `--revision` from the latest `read` for edits to existing content; a stale revision is rejected so manual edits are preserved.
- `fit`: fit the canvas after the initial draw or a major rearrangement; don't move the user's viewport for every small edit.
- `export --out <absolute.png|absolute.svg>`: export the current canvas. PNG is suitable for visual inspection with an image tool. The `.excalidraw` scene itself is saved automatically after agent and manual edits.
- `stop`: stop this file's local service only when requested or for controlled testing. Closing the panel does not lose already saved work. Reopening after a stop returns a new URL.

Patch example:
```json
{
  "create": [
    {"id":"client","type":"rectangle","x":80,"y":80,"width":220,"height":76,"text":"Client","backgroundColor":"#e7e5ff","strokeColor":"#7267ad"},
    {"id":"api","type":"rectangle","x":80,"y":250,"width":220,"height":76,"text":"API service","backgroundColor":"#d8f2e6","strokeColor":"#47826b"},
    {"id":"request","type":"arrow","startElementId":"client","endElementId":"api"}
  ],
  "fit": true
}
```
```json
{"update":[{"id":"api","set":{"text":"Auth service","x":110}}],"delete":[]}
```

Create supports rectangles, ellipses, diamonds, text, arrows, lines and frames. Shape `text` becomes a real bound text element; arrow `startElementId` / `endElementId` creates live bindings and calculates an initial straight route. Explicit unbound arrow `points` support custom routes. Use normal Excalidraw style fields. IDs are stable; do not regenerate the whole diagram to make a small change. Complex routing is a layout task, not an automatic guarantee.

For a narrow side panel, favor a top-to-bottom layout, generous gaps, and readable labels (normally 20+ px, node widths 220–300). Avoid oversized background text and arrows through unrelated boxes. Keep the main diagram compact enough to inspect without opening a second window.

Read before a follow-up edit: the user may have moved shapes, renamed labels, drawn new elements, or used undo. Do not edit the backing JSON while its canvas is running—use `apply`, so the panel and file stay consistent. Drawing waits for an active drag/text edit to finish; if it times out, ask the user to finish that gesture, read the scene, and retry only the necessary change.

After the first meaningful diagram and after a substantial layout change, export a PNG and inspect it. Check labels, arrow endpoints, clipping, and readability. Fix concrete problems. Finish with the file link and a short description; keep the live panel open.

## Recovery

The service atomically saves the current file and keeps 30 previous versions under `~/.local/state/codex-excalidraw-canvas/<file-hash>/history/`. Automatic save status is shown in the panel. Manual changes normally save after 250 ms. A file modified externally or a conflicting edit from another tab is rejected, not silently overwritten. The panel offers a recovery download and reload. Do not discard unsaved edits to resolve a conflict.

On a command timeout, **read the scene before retrying**; an operation may have completed despite a lost response. If a panel tab was restored after its service stopped, run `open` again and navigate that same tab to the new URL. See [runtime details](references/runtime.md) only for troubleshooting, development, or packaging.
