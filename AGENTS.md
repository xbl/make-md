# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Vue 3 UI, editor logic, stores, and shared browser-side helpers. Key areas are `src/components/` for UI panels, `src/editor/` for ProseMirror schema/plugins/serialization, `src/lib/` for app services, and `src/stores/` for Pinia state. Rust-side Tauri commands live under `src-tauri/src/`, grouped by feature such as `workspace/`, `pdf/`, `recent.rs`, and `recovery.rs`. Tests are in `tests/unit/` and `tests/e2e/`. Static icons and app assets live in `src-tauri/icons/`.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies.
- `pnpm dev` starts the Vite frontend for browser-only iteration.
- `pnpm tauri dev` runs the desktop app with the Rust backend.
- `pnpm build` creates a production web build.
- `pnpm tauri build` packages the desktop app.
- `pnpm test` runs unit tests with Vitest.
- `pnpm test:e2e` runs Playwright end-to-end tests.
- `pnpm lint` runs ESLint across the repo.
- `pnpm typecheck` runs `vue-tsc --noEmit`.

## Coding Style & Naming Conventions
Use TypeScript and Vue SFCs with `script setup`. Follow the existing 2-space indentation and keep imports grouped by source and path alias (`@/`). Name Vue components and stores in PascalCase files such as `EditorPane.vue` and `useDocumentsStore`. Keep composables, helpers, and Rust modules focused and feature-based. Run `pnpm lint` and `pnpm typecheck` before opening a PR.

## Testing Guidelines
Use Vitest for unit tests and Playwright for smoke/e2e coverage. Place new unit tests in `tests/unit/*.spec.ts` and e2e coverage in `tests/e2e/*.spec.ts`. Prefer descriptive test names that state behavior, for example `scrollEditorToPosition`. Add or update tests whenever you change editor parsing, workspace actions, document lifecycle, or Tauri command behavior.

## Commit & Pull Request Guidelines
Git history favors short, imperative commits with optional scope, such as `feat: add mermaid` or `fix: improve editor typography`. Keep commits focused and avoid mixing unrelated UI and Rust changes. PRs should explain the user-visible change, list verification commands run, and include screenshots or screen recordings for UI updates. Link related issues when available and call out any platform-specific behavior, especially Tauri or macOS-only flows.

## Agent Notes
Follow the design system defined in `DESIGN.md` for all UI work. Use `var(--token)` references for colors, typography, radii, and shadows — never hardcode visual values.
Prefer small, targeted edits. Check `README.md` and the relevant `docs/superpowers/` plan before adding new behavior, and verify changes with the narrowest useful test command first.
When a task is completed, agents should automatically create a focused git commit before responding, unless the user explicitly says not to commit or the work is blocked.
Maintain a product feature list document at `docs/product/feature-list.md`. Every time a feature is completed or materially changed, update the corresponding module section in that document before responding.
Organize the feature list by product module, and keep each item marked with its current status such as `complete`, `partial`, or `not_started`.
When implementing any user-facing feature, always check whether it introduces new strings (labels, messages, tooltips, menu items, aria labels, status text) that need i18n entries. If so, add the corresponding key-value pairs to both `src/i18n/locales/en.ts` and `src/i18n/locales/zh-CN.ts`. For Tauri native menus, also add entries to `src-tauri/src/i18n.rs`.
For bugs reported against a concrete user artifact such as a specific Markdown file, exported `.docx`, generated PDF, or screenshot, do not rely only on synthetic unit fixtures or guessed root causes. Reproduce against the exact artifact or an extracted minimal sample from it before claiming a fix.
If the first fix attempt does not resolve the user-visible issue, stop making incremental guesses. Inspect the real output directly, for example by unpacking the exported file, checking generated XML, verifying embedded assets, or reading the exact runtime output, then update tests to cover the confirmed failure mode before changing code again.
For export bugs, test both levels before declaring success:
- behavior-level: the user-visible symptom is gone on the real exported artifact
- structure-level: the generated package or file internals are valid, such as unzip/read checks, relationship files, content types, and embedded media entries
When a test passes but the user's real artifact still fails, treat the test as insufficient rather than as evidence that the bug is fixed. Add a regression test derived from the real artifact shape and keep debugging until that test and the real artifact both pass.
