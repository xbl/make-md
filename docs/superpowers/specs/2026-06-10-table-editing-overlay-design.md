# Table Editing Overlay Design

**Date:** 2026-06-10  
**Status:** Draft for review  
**Scope:** Add focused row/column editing controls to Markdown tables in the editor so users can insert and remove rows and columns without leaving WYSIWYG editing.

---

## Goal

When the cursor is inside a Markdown table, the editor should expose direct row and column editing controls adjacent to the focused table. The interaction should feel native to the current editor rather than like a generic context menu or modal workflow.

This closes the biggest remaining table-editing usability gap after table insertion: users can create a table today, but cannot conveniently reshape it in-place.

---

## User Experience

### Trigger and visibility

- When the selection is inside any `table_cell` or `table_header`, show table editing controls.
- When the selection leaves the table, hide the controls immediately.
- Controls are selection-driven, not hover-driven.

### Layout

- Show column controls above the table.
- Show row controls to the left of the table.
- Highlight the currently focused row and column.
- Keep the visual language light and quiet: thin gray strokes, rounded buttons, compact popup menus.

### Supported actions

Column actions for the currently focused column:

- Insert column left
- Insert column right
- Remove column

Row actions for the currently focused row:

- Insert row above
- Insert row below
- Remove row

### Out of scope

- Whole-table delete
- Cell merge/split
- Drag-to-resize columns
- Hover-only affordances
- Spreadsheet-style toolbar expansion

---

## Technical Approach

### Recommended architecture

Implement a Vue overlay component mounted from the editor shell, positioned relative to the focused table DOM node and driven by ProseMirror selection state.

This is preferred over ProseMirror widget decorations because:

- the UI needs richer styling and popup interaction than decorations handle comfortably
- row and column menus are easier to compose in Vue
- it keeps document-transform logic separate from presentation

### Main pieces

#### 1. Table selection state extraction

Add a focused helper that inspects the active editor selection and returns:

- whether the selection is inside a table
- the table node position
- the focused row index
- the focused column index
- enough DOM anchors to position the overlay

This logic should be isolated from rendering so it can be unit tested directly.

#### 2. Table overlay component

Add a dedicated component, expected location:

- `src/editor/TableControlsOverlay.vue`

Responsibilities:

- render top column controls and left row controls
- position itself relative to the active table
- expose compact action menus for the active row and column
- dispatch row/column edit actions back into the editor

This component should not understand table document transforms directly. It should receive derived state plus action callbacks.

#### 3. Editor integration

Integrate the overlay into:

- `src/editor/EditorView.vue`

Responsibilities:

- track the active `EditorView`
- subscribe to selection changes already observable from editor updates
- compute overlay visibility and positioning
- hide overlay when editor focus leaves the table

#### 4. Table transform helpers

Add focused helpers for row/column operations. Expected location:

- `src/editor/table-editing.ts`

Supported transforms:

- insert column before current column
- insert column after current column
- delete current column
- insert row before current row
- insert row after current row
- delete current row

Behavior rules:

- preserve header row semantics when adding columns
- inserted header cells in the header row should be `table_header`
- inserted body cells should be `table_cell`
- deleting the final remaining column is not allowed
- deleting the final remaining row is not allowed

If an operation is blocked because it would remove the last row or column, the action should no-op. No modal warning is required in the first version.

---

## Data Flow

1. User places cursor in a table cell.
2. Editor update runs table selection analysis.
3. Editor shell stores derived table overlay state.
4. Overlay renders beside the active table.
5. User chooses a row/column action.
6. Action callback applies a focused ProseMirror transaction.
7. Editor updates selection and document state.
8. Overlay recomputes against the new table shape.

---

## Positioning Strategy

- Use the focused table element's bounding box relative to the editor container.
- Recompute position on:
  - editor selection changes
  - editor document changes
  - editor scroll
  - window resize
- Prefer simple absolute positioning inside the editor shell over portal-based rendering.

First version priority is correctness and stability, not animation.

---

## Error Handling and Edge Cases

- If the DOM node for the focused table cannot be resolved, do not render the overlay.
- If the selection spans outside a single table, treat the overlay as hidden.
- If the active editor view is unavailable, do not render the overlay.
- If delete row/column would remove the last remaining row/column, no-op and keep the table unchanged.
- After insert/delete operations, keep the selection within the same table whenever possible.

---

## Testing Strategy

Follow TDD strictly: add failing tests first, verify failure, then implement the minimum code to pass.

### Unit tests

Primary targets:

- `tests/unit/editor-table-editing.spec.ts`
- `tests/unit/editor-view.spec.ts` or a focused overlay spec if cleaner

Cover:

- selection inside table produces visible overlay state
- selection outside table hides overlay state
- focused row and column indices are computed correctly
- insert column left/right updates table shape correctly
- remove column updates table shape correctly and is blocked on the last column
- insert row above/below updates table shape correctly
- remove row updates table shape correctly and is blocked on the last row
- overlay action dispatch calls the expected table transform

### Manual verification

- insert a table
- click into different header and body cells
- confirm row/column controls track the focused cell
- insert and delete rows and columns repeatedly
- confirm leaving the table hides controls

No e2e coverage is required in the first pass unless unit coverage reveals a focus-sync gap that cannot be validated reliably otherwise.

---

## Files Expected To Change

- `src/editor/EditorView.vue`
- `src/editor/TableControlsOverlay.vue`
- `src/editor/table-editing.ts`
- `tests/unit/editor-table-editing.spec.ts`
- possibly a focused overlay render spec if needed
- `docs/product/feature-list.md`

---

## Acceptance Criteria

- Table controls appear only when the selection is inside a table.
- Users can insert and delete rows and columns from the overlay.
- Controls visually attach to the active table and reflect the active row and column.
- Leaving the table hides the controls.
- The final remaining row or column cannot be deleted.
- Focused unit tests cover the transform and visibility logic.
