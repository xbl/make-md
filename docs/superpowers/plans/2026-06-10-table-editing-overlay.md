# Table Editing Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add row and column editing controls that appear when the Markdown editor selection is inside a table, letting users insert and remove rows and columns in place.

**Architecture:** Keep table editing split into three focused parts: a pure table-editing module for table selection analysis and ProseMirror transforms, a Vue overlay component for the UI, and thin integration inside the existing editor shell. Drive overlay visibility entirely from editor selection state and keep table mutations out of the view component.

**Tech Stack:** Vue 3 SFCs, TypeScript, ProseMirror, Vitest, Vue Test Utils

**Spec:** `docs/superpowers/specs/2026-06-10-table-editing-overlay-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/editor/table-editing.ts` | Pure helpers for resolving active table state and applying row/column mutations |
| `src/editor/TableControlsOverlay.vue` | Overlay UI that renders row/column controls and emits table actions |
| `src/editor/EditorView.vue` | Editor shell integration, overlay positioning, action callbacks |
| `tests/unit/editor-table-editing.spec.ts` | Unit coverage for table state extraction and row/column transforms |
| `tests/unit/editor-pane.spec.ts` | Integration coverage that overlay appears and dispatches table actions through the mounted editor |
| `docs/product/feature-list.md` | Product status update for table editing ergonomics |

---

## Shared interfaces to introduce

Use these types in `src/editor/table-editing.ts`:

```ts
import type { EditorView } from "prosemirror-view";
import type { Node as PMNode, ResolvedPos } from "prosemirror-model";

export type TableOverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ActiveTableContext = {
  tablePos: number;
  rowIndex: number;
  columnIndex: number;
  rowCount: number;
  columnCount: number;
  rect: TableOverlayRect;
};

export type TableAction =
  | "insert-column-left"
  | "insert-column-right"
  | "remove-column"
  | "insert-row-above"
  | "insert-row-below"
  | "remove-row";

export function getActiveTableContext(
  view: EditorView,
  container: HTMLElement,
): ActiveTableContext | null

export function applyTableAction(
  view: EditorView,
  action: TableAction,
  context: ActiveTableContext,
): boolean
```

Use these props in `src/editor/TableControlsOverlay.vue`:

```ts
type OverlayProps = {
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  rowIndex: number;
  columnIndex: number;
  rowCount: number;
  columnCount: number;
};
```

Events:

```ts
type OverlayEmits = {
  action: [action: TableAction];
};
```

---

## Task 1: Add failing tests for table context extraction and transforms

**Files:**
- Create: `tests/unit/editor-table-editing.spec.ts`
- Reference: `src/editor/schema.ts`
- Reference: `tests/unit/editor-command-events.spec.ts`

- [ ] **Step 1: Write the failing table-context tests**
- [ ] **Step 2: Add failing transform tests**
- [ ] **Step 3: Run the focused test to verify it fails**
- [ ] **Step 4: Commit the failing-test checkpoint**

---

## Task 2: Implement minimal table-editing helpers to satisfy the transform tests

**Files:**
- Create: `src/editor/table-editing.ts`
- Test: `tests/unit/editor-table-editing.spec.ts`

- [ ] **Step 1: Create the minimal helper implementation**
- [ ] **Step 2: Run the helper test to verify it passes**
- [ ] **Step 3: Refactor any duplication while keeping tests green**
- [ ] **Step 4: Commit**

---

## Task 3: Add failing integration tests for overlay visibility and action dispatch

**Files:**
- Modify: `tests/unit/editor-pane.spec.ts`
- Reference: `src/components/EditorPane.vue`
- Reference: `src/editor/EditorView.vue`

- [ ] **Step 1: Write the failing overlay visibility test**
- [ ] **Step 2: Write the failing overlay action test**
- [ ] **Step 3: Run the focused integration test to verify it fails**
- [ ] **Step 4: Commit the failing integration checkpoint**

---

## Task 4: Build the overlay component and wire it into the editor shell

**Files:**
- Create: `src/editor/TableControlsOverlay.vue`
- Modify: `src/editor/EditorView.vue`
- Test: `tests/unit/editor-pane.spec.ts`

- [ ] **Step 1: Create the minimal overlay component**
- [ ] **Step 2: Integrate overlay state into `src/editor/EditorView.vue`**
- [ ] **Step 3: Run the focused integration test to verify it passes**
- [ ] **Step 4: Commit**

---

## Task 5: Refine the overlay to match the intended row/column affordance

**Files:**
- Modify: `src/editor/TableControlsOverlay.vue`
- Modify: `tests/unit/editor-pane.spec.ts`

- [ ] **Step 1: Tighten the overlay test to assert all row/column controls exist**
- [ ] **Step 2: Refine the overlay structure and styling**
- [ ] **Step 3: Run the focused integration test**
- [ ] **Step 4: Commit**

---

## Task 6: Final regression pass and product doc update

**Files:**
- Modify: `docs/product/feature-list.md`
- Verify: `tests/unit/editor-table-editing.spec.ts`
- Verify: `tests/unit/editor-pane.spec.ts`
- Verify: `tests/unit/editor-command-events.spec.ts`

- [ ] **Step 1: Update the product feature list**
- [ ] **Step 2: Run the focused regression suite**
- [ ] **Step 3: Manual verification**
- [ ] **Step 4: Commit**
