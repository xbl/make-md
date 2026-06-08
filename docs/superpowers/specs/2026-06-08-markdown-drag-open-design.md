# Markdown Drag Open Design

**Date:** 2026-06-08  
**Status:** Approved  
**Goal:** Allow users to drag one or more Markdown files onto the app window and open them as document tabs.

---

## Problem

The app can open Markdown files through file pickers, recent files, and the workspace tree, but it does not accept dragged files from the desktop.

That creates a gap for desktop usage:

- Users cannot drag a `.md` file directly into the app to open it.
- Opening several Markdown files at once requires repeating picker actions.
- The app already supports internal file-tree drag/drop, so the lack of window-level file-open drag/drop feels inconsistent.

---

## Approach

Add a window-level drag/drop entry point in the app shell and reuse the existing document open flow.

- `AppShell` listens for `dragenter`, `dragover`, `dragleave`, and `drop`.
- Drag payloads are filtered to `.md` and `.markdown` files only.
- Accepted files are opened by calling the existing `documents.openFile(path)` action for each dropped file.
- A lightweight visual overlay appears only while a valid Markdown drag is hovering over the window.

This keeps the behavior aligned with existing document session logic and avoids adding a second file-open path.

---

## Architecture

### Window-level drop target

Implementation lives at the app shell level:

```text
src/layout/AppShell.vue
```

Reasons:

- It covers the full application window.
- It avoids coupling drag-open behavior to the editor, sidebar, or tab strip.
- It stays separate from file-tree drag/drop behavior used for moving files inside the workspace.

### Document opening path

Dropped files reuse existing document actions:

- `documents.openFile(path)` remains the source of truth.
- Existing behavior for already-open files, recent file tracking, and session activation stays unchanged.

No new backend command is needed for the first version.

---

## Behavior

### Accepted input

First version accepts:

- `.md`
- `.markdown`

First version ignores:

- directories
- images
- non-Markdown text files
- mixed drops where a given item is not a supported Markdown file

### Multi-file handling

If multiple Markdown files are dropped:

- open all accepted files
- preserve the order from the drop payload
- ignore unsupported files without failing the whole drop

### Existing sessions

If a dropped file is already open:

- reuse `documents.openFile(path)`
- activate the existing session instead of duplicating tabs

### Visual feedback

When a valid Markdown drag is over the window:

- show a lightweight overlay
- indicate that dropping will open Markdown files

When the drag leaves the window or drop completes:

- remove the overlay immediately

---

## State and Event Handling

`AppShell` should maintain a minimal local drag state, for example:

- whether a valid drag is active
- optionally a nested drag counter to avoid flicker from child enter/leave events

Recommended event flow:

1. On `dragenter`, inspect the payload and activate overlay only if at least one supported Markdown file is present.
2. On `dragover`, call `preventDefault()` only for accepted Markdown drags so dropping stays enabled.
3. On `dragleave`, clear the active overlay when the pointer leaves the shell boundary.
4. On `drop`, clear overlay, filter files, and open accepted paths through the documents store.

This avoids interfering with unrelated browser drag behavior more than necessary.

---

## Out of Scope

Not included in this release:

- dropping folders to open/switch workspace roots
- dragging files into the editor to insert links or content
- drag-open support for non-Markdown formats
- backend/native Tauri drag event integration
- progress UI or toast notifications for ignored files

These can be separate follow-up specs if needed.

---

## Error Handling

- If no accepted Markdown files are present, do nothing and show no error.
- If one dropped file fails to open, continue attempting the remaining accepted files.
- Use the existing `documents.openFile(path)` error path rather than introducing a new error system.
- Always clear the drag overlay after `drop`, even when file open fails.

---

## Testing

### Unit

- `AppShell` shows the drag overlay when dragging a Markdown file over the app.
- `AppShell` hides the overlay on drag leave.
- Dropping one Markdown file calls `documents.openFile(path)`.
- Dropping several files opens only supported Markdown files and ignores unsupported ones.
- Dropping a non-Markdown file does not call `documents.openFile(path)`.

### Regression

- Existing shell keyboard/menu behavior continues to work.
- File-tree internal drag/drop remains unchanged.

### Manual

- Drag a `.md` file from Finder onto the app and confirm it opens.
- Drag multiple Markdown files and confirm all open as tabs.
- Drag a `.txt` or image file and confirm nothing opens.
- Drag over the window and confirm overlay appears only for supported Markdown files.

---

## Success Criteria

- Users can drag one or more Markdown files onto the app window to open them.
- Only `.md` and `.markdown` files are accepted.
- The implementation reuses the existing document-open flow.
- A clear drag-hover overlay appears for valid Markdown drops.
- Existing internal drag/drop and editor behavior remain unaffected.
