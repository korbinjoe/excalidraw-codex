# Contributing

Thanks for helping improve excalidraw-codex. [Bug reports](https://github.com/korbinjoe/excalidraw-codex/issues), focused fixes, documentation improvements, and reproducible examples are welcome. Fork the repository and open a pull request against `main`.

## Work locally

Use Node.js 22.12+ and npm. From the source directory:

```sh
npm ci
npm test
npm run build
```

For an installed Codex workflow, follow [the development guide](docs/DEVELOPMENT.md). Do not edit an installed plugin cache: it will be replaced on the next installation.

## Propose a change

Explain the user-visible problem, the expected behavior, and how to reproduce it. For code changes, describe what changed and which checks you ran. Include a screenshot for visible UI changes and meaningful regression coverage for changes to persistence, conflicts, authentication, or deployment.

Keep code, comments, interface strings, examples, and documentation in English. Chinese is reserved for `README.zh-CN.md` and README language links. Update both READMEs when changing user-facing instructions. Preserve upstream license notices and user-authored drawing content.

Do not commit generated packages, dependency directories, local session files, marketplace backups, or personal drawings. Never include session tokens in reports or screenshots of URLs.

## Validate

Run `npm test` and `npm run build`. For editor changes, open an isolated test drawing and check the affected behavior, saving, and export. Tests should not modify real user drawings or stop unrelated canvas services.

Maintainers installing a local change run `npm run codex:update`, which includes tests, build, plugin validation, and installed-file verification. See [validation notes](docs/VALIDATION.md) for the existing coverage and limitations.

## License

By submitting a contribution, you agree that it may be distributed under the project's [MIT License](LICENSE). Third-party code or assets must retain their applicable notices.
