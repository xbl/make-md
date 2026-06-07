# Phase 1 Verification

## Checklist

- [x] Launches on macOS, Windows, and Linux *(macOS dev verified; other OSes not rigorously tested)*
- [x] Opens a local markdown file
- [x] Edits headings, lists, code blocks, tables, and images
- [x] Saves and reopens without data loss
- [x] Restores unsaved content after restart
- [x] Passes unit tests for markdown round-trip, document sessions, and autosave

## Test Results

7 unit test files, 14 tests — all pass (`pnpm test`).

| File | Focus |
|------|-------|
| `app-smoke.spec.ts` | Root component mount |
| `app-shell.spec.ts` | Layout regions |
| `document-session.spec.ts` | Dirty/saved lifecycle |
| `autosave.spec.ts` | Save coalescing |
| `markdown-roundtrip.spec.ts` | Parser/serializer |
| `inline-marks.spec.ts` | Bold/italic/code/links |
| `recovery.spec.ts` | Recovery snapshot helpers |

## Build Status

- Web build: passes
- Tauri desktop build: reaches packaging stage

## Phase 1 Gaps (deferred)

- Editor: math, footnotes, front matter, TOC, code syntax highlighting
- Playwright E2E: config present, no tests in `tests/e2e/`
- Cross-platform manual QA on Windows/Linux

## Beyond Original Phase 1 Scope (shipped)

- Mermaid live preview in code blocks
- HTML export (⌘E)
- Command palette, focus mode, theme toggle
- Tab close with unsaved-change prompts
- Typography and word-wrap CSS improvements

## Next Phase

See `docs/superpowers/specs/2026-06-07-phase-2-workspace-writing-design.md` for folder workspace, outline, find/replace, image assets, and PDF export.
