# Context Menu Design

**Date:** 2026-06-07  
**Status:** Approved  
**Goal:** Add a shared frontend context-menu system for the editor, file tree, and tab strip, and implement `Insert Table` as a real editor command.

---

## Problem

The app has inconsistent right-click behavior:

- File tree uses a local inline menu implementation.
- Editor has no context menu and only receives commands from the desktop menu bridge.
- Tab strip has no context menu.
- `paragraph.table` exists in the command catalog but is not implemented.

This makes common actions harder to discover and duplicates menu logic across surfaces.

---

## Approach

Use a shared frontend context-menu component and small per-surface adapters:

- A reusable `ContextMenu` component renders menu items, position, disabled state, separators, and close behavior.
- A lightweight menu controller/composable manages open/close, click-away, and keyboard dismissal.
- Editor, file tree, and tab strip provide menu items based on their local context and reuse existing store/service/command handlers.
- `Insert Table` is implemented in the editor command system under `paragraph.table`, so context menu is only a new entry point.

This keeps command logic centralized and avoids creating a second action system for right-click behavior.

---

## Architecture

### Shared menu layer

Add shared UI primitives for context menus:

```text
src/components/ContextMenu.vue
src/lib/context-menu.ts
```

Responsibilities:

- Render menu at viewport coordinates.
- Support item label, disabled state, optional shortcut label, and separator rows.
- Close on outside click, Escape, scroll, or after successful action.
- Keep the item model generic so all surfaces can reuse it.

### Surface adapters

- `FileTreeNode.vue` stops rendering its inline hardcoded menu and instead opens the shared context menu with file- or folder-specific items.
- `TabStrip.vue` adds right-click support on each tab and maps tab actions to document/workspace handlers.
- `EditorView.vue` listens for `contextmenu` on the editor DOM, computes editor-specific items, and dispatches existing editor commands.

### Editor command integration

`src/editor/editor-command-events.ts` becomes the single place for editor command execution triggered by:

- desktop menu bridge
- keyboard shortcuts
- context menu

`paragraph.table` is implemented here alongside existing paragraph and format commands.

---

## Menu Content

### Editor

First version menu items:

- Cut
- Copy
- Paste
- Select All
- Bold
- Italic
- Inline Code
- Heading 1
- Heading 2
- Heading 3
- Paragraph
- Insert Table

Behavior notes:

- Formatting and paragraph actions use existing editor command ids.
- `Insert Table` triggers `paragraph.table`.
- Items that cannot run in the current editor state are disabled.

### File tree

#### File node

- Open
- Rename
- Delete
- Reveal in Finder

#### Folder node

- New File
- Reveal in Finder

Behavior notes:

- Existing file tree actions remain the source of truth.
- Menu selection also updates workspace selection state before running the action.

### Tab strip

- Close
- Close Others
- Reveal in Finder

Behavior notes:

- `Reveal in Finder` is only shown or enabled when the tab has a real file path.
- `Close Others` closes every other open session, preserving current unsaved-change prompts.

---

## Insert Table

`paragraph.table` becomes a real editor command with prompt-driven input.

### Input flow

When the command runs:

1. Prompt for column count.
2. Prompt for row count.
3. Validate both values as positive integers.
4. Abort cleanly if the user cancels either prompt or enters invalid values.
5. Insert a Markdown table template at the current selection.

### Table generation

Generate:

- one header row
- one separator row
- N body rows, where N is the requested row count

Example for `3` columns and `2` rows:

```md
|   |   |   |
| --- | --- | --- |
|   |   |   |
|   |   |   |
```

### Insertion behavior

First version behavior:

- Do not try to transform selected text into a table.
- Do not infer surrounding structure.
- Insert a standalone table block near the current cursor position.
- Preserve a valid cursor position after insertion so the user can continue editing immediately.

This keeps the first release predictable and testable.

---

## Error Handling

- Invalid row/column input shows a simple alert and does not mutate the document.
- Failed workspace actions continue to use the existing `try/catch + alert` behavior.
- Context menu always closes after an attempted action, even when the action later fails.
- If an editor command is unavailable, the menu item is disabled rather than hidden, except for items whose context does not apply at all.

---

## Testing

### Unit

- Shared context menu component renders items, disabled state, and closes correctly.
- File tree menu regression coverage for file and folder actions.
- Tab strip menu coverage for close, close others, and reveal behavior.
- Editor command tests for `paragraph.table`:
  - cancel on first prompt
  - cancel on second prompt
  - invalid column count
  - invalid row count
  - successful Markdown insertion

### Regression

- Existing editor command event tests continue to pass.
- Existing document close/save prompt behavior is preserved for tab actions.

### Manual

- Right-click editor, file tree node, and tab all open the correct menu at cursor position.
- Clicking outside or pressing Escape closes the menu.
- `Insert Table` inserts a table with the requested size.
- File tree and tab actions still honor unsaved changes.

---

## Success Criteria

- Right-click menus exist for editor, file tree, and tab strip.
- All three surfaces use one shared frontend menu system.
- File tree no longer owns a separate inline menu implementation.
- `paragraph.table` works from the context menu and inserts prompt-configured Markdown tables.
- Existing command handlers, workspace actions, and unsaved-change flows remain intact.
