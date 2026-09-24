# excalidraw-codex

**English** | [简体中文](README.zh-CN.md)

Draw with Codex. Refine by hand. Keep an editable file.

`excalidraw-codex` brings the Excalidraw editor into the Codex side panel. Describe a flowchart, architecture diagram, or idea in conversation, then move shapes and edit labels directly on the canvas. Follow-up requests work with the current drawing, including your manual edits.

![An editable diagram created with excalidraw-codex](assets/diagram.png)

## What you can do

- Create and revise diagrams through natural-language requests.
- Edit shapes, text, and connected arrows in the live Excalidraw editor.
- Save automatically to a standard `.excalidraw` file in your project.
- Export PNG and SVG for documents, presentations, and sharing.
- Recover earlier versions from local history, with conflict detection for concurrent changes.

The plugin uses Excalidraw 0.18.1 and the Codex app's browser panel. It is an independent, MIT-licensed project, with no additional diagram-service account or API key required.

## Install

The installation workflow is validated on macOS. You need:

- Codex desktop with plugin support and an in-app browser panel, plus the `codex` CLI on your `PATH`.
- Node.js **22.12+** and npm to build from source. A packaged plugin only needs Node.js 20+ at runtime.
- `python3`, `rsync`, and the Codex `plugin-creator` system skill for local installation.

Download or clone the source into a directory under your home folder, then run these commands from that directory:

```sh
git clone https://github.com/korbinjoe/excalidraw-codex.git ~/excalidraw-codex
cd ~/excalidraw-codex
npm ci
npm run codex:register
npm run codex:update
```

Registration creates or updates the plugin's entry in your personal marketplace, backing up an existing catalog and preserving other entries. The update command tests, builds, validates, installs, and verifies the plugin. See [development details](docs/DEVELOPMENT.md) for custom tool locations and upgrading from the old name.

**Start a new Codex task after installation** so it loads the new Skill.

## Try it

Ask Codex:

> Use excalidraw-codex to draw a login flowchart. Open it in the side panel and save it as diagrams/login.excalidraw in this project.

Then try:

> Add a two-factor authentication branch after the password check.

> Keep my layout, rename the API node to Auth service, and export an SVG.

You can also drag shapes, change labels, or draw directly in the panel. Keep the panel open while Codex applies changes or exports images; those operations use the live editor. To return to a diagram, ask Codex to open its `.excalidraw` file.

Automatic arrow placement starts with straight routes. For complex diagrams, ask Codex to refine the layout and check an exported preview.

## Files, privacy, and recovery

Your `.excalidraw` file is the saved drawing and can be opened in other compatible editors. Manual edits normally autosave after about 250 ms; check the **Saved** indicator before closing the panel. A crash can lose edits still waiting to save.

The plugin serves the editor and fonts locally, listens only on `127.0.0.1`, and protects its API with a random session token. The plugin does not upload drawings to a diagram service. Codex itself processes your requests and any scene data it reads according to your Codex settings.

The last 30 previous versions are stored under:

```text
~/.local/state/codex-excalidraw-canvas/<file-hash>/history/
```

The legacy directory name is intentionally retained so existing sessions and history remain available after the rename.

If another program or panel changes the same file, the editor reports a conflict. Use **Download a copy** before **Reload** to preserve unsaved edits. To restore a history file, ask Codex to stop the affected canvas, copy the chosen version to a new `.excalidraw` file, and open that copy.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Codex does not discover the plugin | Start a new task after installation. Check `codex plugin list`. |
| Drawing commands say the panel is required | Ask Codex to reopen the canvas in the side panel and wait for it to connect. |
| A command times out | Ask Codex to read the current scene before retrying; the change may already have been saved. |
| The service restarted or a restored tab cannot connect | Ask Codex to reopen the file to get a fresh local URL. |
| An update is not visible in an existing canvas | Confirm it is saved, then ask Codex to stop and reopen that canvas. Running services keep their original backend. |
| The client has no in-app browser | Open the returned local URL in a browser. The integrated side-panel experience requires a compatible Codex desktop app. |

## Development and contributions

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks, [the development guide](docs/DEVELOPMENT.md) for packaging and installation, and [validation notes](docs/VALIDATION.md) for tested behavior and limits.

Project code, interface text, examples, and contributor documentation are written in English. This README is also available in [Simplified Chinese](README.zh-CN.md).

## License and credits

[MIT License](LICENSE) · Copyright (c) 2026 Joebon.

Built with [Excalidraw](https://github.com/excalidraw/excalidraw), React, and Vite. Dependencies retain their own licenses; see [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). This project is not affiliated with or endorsed by OpenAI or the Excalidraw project.
