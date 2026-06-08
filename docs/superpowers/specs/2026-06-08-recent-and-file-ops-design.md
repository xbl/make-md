# Recent List and File Operations Design

**Date:** 2026-06-08  
**Status:** Approved  
**Goal:** Add removal controls for the `RECENT` file list and complete the missing file-operation entry points in the file tree, without expanding scope to tab-strip context menus.

---

## Problem

The app already persists and displays recent files, and the workspace layer already supports core file operations, but two user-facing gaps remain:

- The `RECENT` list can open files, but cannot remove a single entry or clear the list.
- File operations exist in backend/store flows, but the interactive entry points are incomplete or inconsistent from the user perspective.

This makes file management feel partially implemented even though much of the command layer already exists.

---

## Scope

### In scope

1. Add `RECENT` list actions:
   - remove a single recent entry
   - clear all recent entries
   - reveal a recent file in Finder when the path still exists
2. Complete and align file-tree operation entry points:
   - open
   - new file
   - rename
   - delete
   - reveal in Finder
3. Reuse the shared frontend context-menu system for these actions.
4. Add backend commands and frontend service/store wiring needed for recent-file mutation.

### Out of scope

- Tab strip context menu work
- New file operations beyond the existing workspace model
- Directory delete / directory rename
- Bulk recent-item management beyond single remove and clear all
- Any AI-editing functionality

---

## Existing Foundations

### Recent files

- `src/components/Sidebar.vue` renders the `RECENT` list as simple buttons.
- `src/stores/documents.ts` owns `recentFiles` state and already loads/saves it.
- `src-tauri/src/recent.rs` currently exposes:
  - `load_recent_files`
  - `save_recent_file`

Missing:

- remove recent item
- clear recent list
- UI actions for either behavior

### File operations

- `src-tauri/src/workspace/files.rs` already implements:
  - `create_file`
  - `rename_file`
  - `delete_file`
  - `move_file`
  - `reveal_in_finder`
- `src/components/FileTreeNode.vue` already uses the shared `ContextMenu` and exposes:
  - file: `Open`, `Rename`, `Delete`, `Reveal in Finder`
  - folder: `New File`, `Reveal in Finder`

What is still missing is not the raw operation set, but product-level completion and consistency:

- explicit design coverage for file-tree operations as a complete user-facing surface
- recent-list actions that match the same interaction model
- clean store/service APIs for recent-list mutation

---

## Approach

Use the existing shared context-menu system as the single interaction model for both surfaces:

- `RECENT` entries gain a shared context menu
- the `RECENT` panel background or header gains a clear-all action
- file-tree menus remain shared-context-menu based and are brought into this design as the canonical file-ops surface

This avoids inventing a second action model like per-row inline delete buttons, and keeps file management behavior consistent across the app.

---

## UX Design

## `RECENT` list

### Per-item menu

Right-clicking a recent item opens a context menu with:

- `Open`
- `Remove from Recent`
- `Reveal in Finder`

Behavior:

- `Open` matches current click behavior.
- `Remove from Recent` removes only the recent entry, not the file on disk.
- `Reveal in Finder` is disabled or no-ops gracefully if the path no longer exists.

### List-level action

The `RECENT` panel supports `Clear Recent` via one of these entry points:

- header action button, or
- right-click on empty panel area

For this iteration, a header action is preferred because it is discoverable and simpler than adding empty-area menu targeting.

Behavior:

- `Clear Recent` removes all persisted recent entries.
- It does not close already open tabs.
- It does not delete any files on disk.

### Visual rules

- Existing “Recent” list row styling stays unchanged for left-click open.
- Context menu items use the shared menu visual system already defined for file tree/editor work.
- The header action should match the panel action style already used in `Sidebar.vue`.

---

## File tree operations

The file tree is the canonical file-management surface for workspace files.

### File node menu

- `Open`
- `Rename`
- `Delete`
- `Reveal in Finder`

### Folder node menu

- `New File`
- `Reveal in Finder`

### Behavior requirements

- `Rename` keeps the current extension behavior already implemented in `FileTreeNode.vue`.
- `Delete` continues to confirm first and respects unsaved-session protection.
- `New File` continues to create Markdown files only.
- `Reveal in Finder` uses the existing Tauri command.
- Drag-move remains supported and unchanged.

This design does not add more file-tree actions; it codifies the current menu as required functionality and ensures it remains part of the implementation scope.

---

## Data and Command Design

### Rust commands

Add two new Tauri commands in `src-tauri/src/recent.rs`:

- `remove_recent_file(path: String) -> Result<Vec<String>, String>`
- `clear_recent_files() -> Result<Vec<String>, String>`

Behavior:

- Both commands mutate the persisted `recent.json`.
- Both return the updated full recent list so the frontend can stay source-of-truth aligned with disk.

Helper functions should be added for:

- removing a specific path from the list
- clearing the list entirely
- saving the full current recent list in one place to avoid duplicated file-write logic

### Frontend service layer

Extend `src/lib/file-service.ts` with:

- `removeRecentFile(path: string)`
- `clearRecentFiles()`

These mirror the existing `loadRecentFiles()` / `saveRecentFile()` pattern.

### Store layer

Extend `src/stores/documents.ts` with actions such as:

- `removeRecent(path: string)`
- `clearRecent()`

Responsibilities:

- call the file-service functions
- replace `recentFiles` with the returned authoritative list
- keep already-open sessions untouched

The store should remain the only owner of recent-file state mutation from the UI.

---

## Error Handling

### Recent list

- Removing a missing path from recent should still succeed and simply return the filtered list.
- Clearing an already-empty recent list should succeed and return `[]`.
- Backend persistence errors surface as alerts using the app’s existing lightweight error pattern.

### File tree

- Existing `window.alert(...)` behavior remains for failed create/rename/delete/reveal actions.
- Existing unsaved prompt flow remains authoritative before delete/close side effects.

---

## Testing

### Unit tests

#### Rust

Add tests in `src-tauri/src/recent.rs` for:

- removing an existing path
- removing a missing path
- clearing all entries

#### Frontend

Add or extend tests for:

- `Sidebar.vue` recent-item context menu open
- remove single recent item
- clear all recent items
- file-tree menu actions remain wired:
  - new file
  - rename
  - delete
  - reveal

### Regression coverage

- Opening a recent file by left click still works
- Removing a recent entry does not close an already-open document
- Clearing recents does not affect session state
- File-tree delete still respects unsaved-change flow

---

## Success Criteria

- Users can remove a single file from `RECENT`.
- Users can clear the entire `RECENT` list.
- These actions update persisted recent-file state, not just the in-memory UI.
- File-tree operations remain available and consistent through the shared context menu.
- No tab-strip menu changes are introduced in this work.

---

## Notes

- This design deliberately treats file-tree work as “complete and align the interaction surface,” not “invent new file operations.”
- The minimum valuable outcome is recent-list management plus a verified, stable file-tree action surface.
