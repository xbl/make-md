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
Prefer small, targeted edits. Check `README.md` and the relevant `docs/superpowers/` plan before adding new behavior, and verify changes with the narrowest useful test command first.
When a task is completed, agents should automatically create a focused git commit before responding, unless the user explicitly says not to commit or the work is blocked.
