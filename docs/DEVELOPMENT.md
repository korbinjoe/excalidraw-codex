# Development and distribution

## Source layout

| Path | Purpose |
| --- | --- |
| `src/` | React wrapper and diagram operations for the Excalidraw editor |
| `runtime/` | Local Node server and atomic scene storage |
| `scripts/canvas.mjs` | CLI used by the Skill |
| `skills/excalidraw-codex/` | Codex workflow and runtime reference |
| `scripts/lib/` | Package synchronization and marketplace registration |
| `tests/` | Persistence, HTTP, and deployment checks |
| `.codex-plugin/plugin.json` | Plugin identity and base version |

## Local installation

Keep a source checkout under your home directory. Install build dependencies with `npm ci`, then run:

```sh
npm run codex:register
npm run codex:update
```

The registration command creates, relocates, or explicitly renames a local entry in `~/.agents/plugins/marketplace.json`. Existing catalogs are backed up to `artifacts/marketplace-backups/`. Other entries, their order, and marketplace metadata are preserved. A missing catalog is initialized as `personal`.

The update command requires `node`, `npm`, `python3`, `rsync`, `codex`, and the Codex `plugin-creator` system skill. By default, the helper scripts are resolved under `$CODEX_HOME/skills/.system/plugin-creator`, using `~/.codex` when `CODEX_HOME` is unset. Set `CODEX_PLUGIN_CREATOR_DIR` to the skill directory if it is installed elsewhere.

Each update:

1. Runs the tests and builds the editor, including local fonts.
2. Stages and validates the package, then applies the plugin-creator cachebuster.
3. Generates `.codex-build/excalidraw-codex` inside the checkout.
4. Installs `excalidraw-codex@<marketplace-name>` through `codex plugin add`.
5. Verifies every installed file and writes `.local-deploy.json`.

Normal updates do not rewrite the marketplace or stop canvas services. The base version in the source manifest remains intentional; the installed version receives a `+codex.<timestamp>` suffix. Dependencies, Git metadata, drawings, release archives, and local deployment state are excluded from generated packages.

Start a new Codex task after installation. For an existing canvas, confirm **Saved**, stop that file's service, and reopen it to load backend changes. Do not interrupt unrelated canvases.

## Upgrade from excalidraw-canvas

Use the updated source and run:

```sh
npm ci
npm run codex:register -- --rename-from excalidraw-canvas
npm run codex:update
```

Registration replaces the old catalog entry in place and backs up the catalog first. It rejects ambiguous entries and a conflicting new name. It does not uninstall the old runtime cache.

After the new installation is verified and all old canvas services have been saved and closed, remove the previous installation with `codex plugin remove excalidraw-canvas@personal` (substitute your marketplace name if different). Removing an installation while an old canvas uses its assets can break that canvas.

The runtime continues using `~/.local/state/codex-excalidraw-canvas` and the `EXCALIDRAW_CANVAS_STATE` override for backward compatibility. This preserves existing history and lets the CLI find an already-running canvas instead of starting a competing writer. New scene metadata identifies the project as `excalidraw-codex`.

## Build and package

```sh
npm test
npm run build
npm run package
```

`npm run package` builds the frontend before producing `release/excalidraw-codex-<version>.zip`. The archive contains a ready-to-run editor, runtime, Skill, documentation, and license notices. It does not contain the source checkout or development dependencies. The source-install commands in the README apply to the source checkout, not this runtime archive. Distribution through a configured marketplace is separate from building the archive; these scripts do not publish a repository or submit to a public marketplace.

## Isolated runtime checks

Set `EXCALIDRAW_CANVAS_STATE` to a temporary directory and use a temporary `.excalidraw` file. Run `node scripts/canvas.mjs help` for commands. Open the URL from `open` in a browser before using `apply` or `export`. Use `read` before follow-up edits, and stop only the test canvas when finished.
