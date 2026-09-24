# Validation — 2026-09-24

Validated in the current macOS Codex desktop app, including its real right-hand in-app browser.

## Automated checks

Initial validation: 8 passing runtime integration/unit tests (before deployment tests were added):

- Atomic persistence and restoration of labels, image data, and element relationships.
- Stale revision rejection.
- External file modification detection without overwriting the external file.
- Invalid/duplicate element rejection without corrupting the saved scene.
- Independent file sessions.
- Retention of 30 history entries.
- Token authentication and foreign-origin rejection.
- Useful panel-not-open errors and rejection of malformed HTTP writes.

Plugin manifest and Skill validation passed.

## Actual editor / panel checks

- Opened the packaged editor in the current task's right browser panel.
- Created three labeled Chinese nodes and two bound arrows through the bundled CLI; verified the diagram appeared in the panel.
- Created a separate test scene; renamed and moved a node through a conversation-side command. Verified its label followed and both connected arrows rerouted.
- Used the actual editor to change a label manually in Chinese. Then moved that node through the CLI and asserted the hand-edited text was preserved in the saved scene.
- Sent a stale revision and observed rejection.
- Pressed Cmd+Z in the editor; confirmed saved geometry returned to the prior location without losing the manually edited label.
- Exported both PNG and SVG successfully.
- Stopped and restarted the test service; navigated to its new URL and visually verified the diagram and hand-edited text were restored.
- Browser error log was empty on the inspected demo page.

## Scope

This verifies the current Codex app and ordinary flowchart editing. It is not a guarantee for all Codex versions, arbitrary diagram sizes, every Excalidraw feature, or simultaneous edits from many users. The integration is a Skill plus the supported browser panel, not a private native editor extension. Public marketplace publication is separate from personal marketplace installation.

## Rename and open-source preparation — 2026-09-24

- Renamed the plugin, npm package, Skill, scene source metadata, and release archive to `excalidraw-codex`.
- `npm test`: 12 passing checks, including registration/rename preservation, collision rejection, and unsafe destination rejection.
- Plugin manifest and Skill validation passed.
- Opened a new isolated scene in Chromium, checked the English welcome screen and editor at 960 and 480 px widths, and confirmed the saved status.
- Applied the English demo patch through the CLI and exported PNG and SVG. Visually inspected the PNG and editor screenshot; the README image is an actual editor export.
- Browser console reported only an unimplemented `/favicon.ico` request (404); no application errors were observed.
- Scanned maintained text outside the READMEs for Chinese characters. User drawings, local artifacts, generated bundles, and third-party dependencies are outside that policy.

Historical panel checks above describe the earlier build. The rename checks use an isolated Chromium canvas and do not revalidate the Codex host integration or interrupt existing user canvases.
