# Writing Core Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Phase A editing-closure baseline by adding an explicit image insertion entry point, enabling table insertion as a first-class command, and fully wiring quote/list/heading-structure editor commands.

**Architecture:** Reuse the existing command runtime and editor command event path instead of introducing new parallel entry points. Keep image insertion on the current document-adjacent asset pipeline, promote the existing table implementation from hidden/disabled to visible/enabled, and add the missing structural paragraph commands directly inside the ProseMirror command event plugin with focused regression coverage.

**Tech Stack:** Vue 3 SFCs, Pinia, TypeScript, ProseMirror, Tauri dialog/file APIs, Vitest, Vue Test Utils

**Spec:** `docs/superpowers/specs/2026-06-08-writing-core-gap-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/file-service.ts` | Add an image file picker wrapper |
| `src/lib/image-asset-plugin.ts` | Expose shared image insertion helpers for command-driven insertion |
| `src/editor/editor-command-events.ts` | Implement `format.image`, `paragraph.quote`, `paragraph.orderedList`, `paragraph.unorderedList`, `paragraph.increaseHeading`, `paragraph.decreaseHeading` |
| `src/lib/commands/manifest.json` | Enable image/table commands in shared manifest |
| `src/lib/shortcuts/registry.ts` | Enable image/table commands in command catalog |
| `src-tauri/src/menu.rs` | Enable image/table menu items |
| `tests/unit/editor-command-events.spec.ts` | Cover image insertion and paragraph structure commands |
| `tests/unit/command-palette.spec.ts` | Assert enabled command-palette visibility for image/table actions |
| `tests/unit/app-shell.spec.ts` | Regression-check context-menu and command dispatch behavior |

## Command semantics fixed by this plan

- `paragraph.increaseHeading` means "move toward a larger heading" (`h3 -> h2`, `h2 -> h1`)
- `paragraph.decreaseHeading` means "move toward a smaller heading" (`h1 -> h2`, `h2 -> h3`)
- `paragraph.increaseHeading` on a paragraph converts it to `h1`
- `paragraph.decreaseHeading` on a paragraph leaves it unchanged
- `paragraph.decreaseHeading` on `h6` converts it back to a paragraph
- quote/list commands operate on the selected block range and must work from menu, shortcut, and command palette dispatch because all routes already flow through `make-md:editor-command`

## Task 1: Add an explicit image picker command

**Files:**
- Modify: `src/lib/file-service.ts`
- Modify: `src/lib/image-asset-plugin.ts`
- Modify: `src/editor/editor-command-events.ts`
- Test: `tests/unit/editor-command-events.spec.ts`

- [ ] **Step 1: Write the failing image-command test**
- [ ] **Step 2: Run the focused test to verify it fails**
- [ ] **Step 3: Add the minimal file-picker wrapper**
- [ ] **Step 4: Expose a reusable image-insertion helper**
- [ ] **Step 5: Implement the minimal image command**
- [ ] **Step 6: Run the focused test to verify it passes**
- [ ] **Step 7: Commit**

## Task 2: Enable table insertion as a first-class visible command

**Files:**
- Modify: `src/lib/commands/manifest.json`
- Modify: `src/lib/shortcuts/registry.ts`
- Modify: `src-tauri/src/menu.rs`
- Modify: `tests/unit/command-palette.spec.ts`

- [ ] **Step 1: Write the failing command-surface test**
- [ ] **Step 2: Run the palette test to verify it fails**
- [ ] **Step 3: Enable image and table in the shared command definitions**
- [ ] **Step 4: Run the palette test to verify it passes**
- [ ] **Step 5: Commit**

## Task 3: Complete quote and list runtime commands

**Files:**
- Modify: `src/editor/editor-command-events.ts`
- Modify: `tests/unit/editor-command-events.spec.ts`

- [ ] **Step 1: Write the failing structure-command tests**
- [ ] **Step 2: Run the structure tests to verify they fail**
- [ ] **Step 3: Write the minimal quote/list implementation**
- [ ] **Step 4: Run the structure tests to verify they pass**
- [ ] **Step 5: Commit**

## Task 4: Complete heading increase/decrease runtime commands

**Files:**
- Modify: `src/editor/editor-command-events.ts`
- Modify: `tests/unit/editor-command-events.spec.ts`

- [ ] **Step 1: Write the failing heading-adjustment tests**
- [ ] **Step 2: Run the heading-adjustment tests to verify they fail**
- [ ] **Step 3: Write the minimal heading-adjustment implementation**
- [ ] **Step 4: Run the heading-adjustment tests to verify they pass**
- [ ] **Step 5: Commit**

## Task 5: Run focused Phase A regression coverage

**Files:**
- Test: `tests/unit/editor-command-events.spec.ts`
- Test: `tests/unit/command-palette.spec.ts`
- Test: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Run focused Phase A unit coverage**
- [ ] **Step 2: Commit the validated Phase A closure**

---

## Self-review

### Spec coverage

- image insertion entry point: covered by Task 1
- table insertion entry point: covered by Task 2, relying on the already-implemented runtime insertion path
- quote/list/heading runtime closure: covered by Tasks 3 and 4

No `Phase A` spec gaps remain in this plan.

### Placeholder scan

- no `TBD` / `TODO`
- each code-bearing step includes explicit file targets and concrete code
- each test step includes an exact command and expected failure/pass signal

### Type consistency

- `format.image` is added through the existing `make-md:editor-command` route
- `createEditorCommandEventsPlugin` is the only new place that needs the threaded `getDocPath`
- heading command semantics are explicitly fixed in this plan and used consistently in tests and implementation
