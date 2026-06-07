# Phase 2: Workspace & Writing Experience Design

**Date:** 2026-06-07  
**Status:** Approved  
**Scope:** Folder workspace (Typora mode) + outline panel + in-document search/replace + image assets + built-in PDF export

---

## Summary

Phase 2 extends make-md from a single-file / recent-files editor into a folder-based writing workspace with Typora-like navigation, while deepening core writing UX: document outline, find/replace, paste/drop images into `assets/`, and one-click PDF export via a built-in engine.

Phase 1 gaps (math, footnotes, front matter, TOC, syntax highlighting, workspace-wide search) are explicitly out of scope for Phase 2.

---

## User Decisions (Brainstorming)

| Topic | Choice |
|-------|--------|
| Workspace model | Typora mode: open folder as root, browse `.md` in tree, open in tabs; keep recent files |
| Sidebar layout | Left tab switch: **Files** \| **Outline** |
| Search | In-document only: ⌘F find, replace bar |
| Images | Paste/drop → copy to `assets/` next to document, insert relative path |
| PDF | Built-in engine (no system print dialog) |
| File tree ops | Full management: create, rename, delete, drag-move, reveal in Finder |

---

## Architecture

### High-level layout

```
┌─────────────────────────────────────────────────────────┐
│  AppShell                                               │
│  ┌──────────────┐  ┌─────────────────┐                 │
│  │ SidebarTabs  │  │ EditorPane      │                 │
│  │ Files|Outline│  │ + FindReplace   │                 │
│  └──────┬───────┘  └────────┬────────┘                 │
└─────────┼───────────────────┼───────────────────────────┘
          │                   │
   folder-workspace      documents store
   store (tree, root)    (tabs, dirty, content)
          │                   │
          └─────────┬─────────┘
                    ▼
            Tauri workspace commands
            (list, watch, crud, assets, pdf)
```

### Rust layer (`src-tauri/src/workspace/`)

| Command | Responsibility |
|---------|----------------|
| `open_folder` | Pick/normalize folder root path |
| `list_markdown_tree` | Recursive `.md` listing; exclude `.git`, `node_modules`, hidden dirs |
| `watch_folder` | Emit change events for external filesystem updates |
| `create_file` | Create `.md` under a folder |
| `rename_file` | Rename file; validate conflicts |
| `delete_file` | Delete `.md` with safety checks |
| `move_file` | Move file between folders |
| `reveal_in_finder` | Platform reveal (Finder / Explorer) |
| `copy_image_asset` | Copy image into `<doc-dir>/assets/`, return relative path |
| `export_pdf` | Render HTML to PDF file without system print dialog |

Existing `fs.rs` read/write markdown commands remain; workspace module owns directory operations.

### Frontend modules

| Module | Purpose |
|--------|---------|
| `src/stores/folder-workspace.ts` | Root path, tree nodes, expansion, selection, watch refresh |
| `src/components/SidebarTabs.vue` | Files \| Outline tab container |
| `src/components/FileTree.vue` | Tree UI, context menu, drag-drop |
| `src/components/OutlinePanel.vue` | Heading list from active editor |
| `src/editor/find-replace.ts` | ProseMirror plugin + match navigation |
| `src/components/FindReplaceBar.vue` | Search/replace UI |
| `src/lib/image-assets.ts` | Paste/drop handlers → Tauri copy → insert image node |
| `src/lib/export-pdf.ts` | HTML generation + `export_pdf` invoke |

`documents` store keeps tab/session lifecycle. `workspace` store keeps recent-file shortcut list when no folder is open.

---

## Data Flow

### Open folder

1. User triggers **Open Folder** (⌘⇧O or command palette).
2. Dialog returns path; Rust normalizes and persists to `recent-workspaces.json`.
3. `list_markdown_tree` builds tree; `watch_folder` starts.
4. Sidebar switches to **Files** tab. If no folder open, sidebar shows **Recent** fallback (current behavior).

### Open file from tree

Click node → `documents.openFile(path)` → activate existing tab or create session → outline refreshes from active editor state.

### File CRUD and tab sync

| Operation | Behavior |
|-----------|----------|
| New | Context menu on folder → name input → `create_file` → open new tab |
| Rename | Inline edit in tree → `rename_file` → update tab `session.path` and id |
| Delete | Confirm → `delete_file` → close tab (unsaved prompt if dirty) |
| Move | Drag to folder → `move_file` → update tab path |
| Reveal | `reveal_in_finder(path)` |

### External file changes

`watch_folder` emits `workspace:changed` → debounced tree refresh (300ms). If active file changed on disk, status bar offers **Reload** or **Keep editing**.

### Untitled save

Save As defaults to workspace root or selected tree folder when a folder is open.

---

## Feature Specifications

### Outline panel

- Extract `heading` nodes (levels 1–6) from active tab ProseMirror `doc`.
- Nested list; click scrolls editor to heading position.
- Debounce updates 200ms on doc change.
- Empty state when no headings.

### Find / replace

- ProseMirror plugin with floating bar (Typora-style).
- ⌘F: find; ⌘⌥F: replace (exact shortcut finalized in implementation).
- Highlight all matches; Enter / Shift+Enter for next/previous.
- Replace one / replace all within current document only.
- Toggles: case sensitive, whole word. Esc closes bar.

### Image paste / drop

1. Intercept paste/drop with image MIME or file path in editor.
2. If document has no saved path, prompt user to save first.
3. `copy_image_asset` writes to `<doc-dir>/assets/` (create if missing).
4. Filename: `{timestamp}-{original}` or `paste-{uuid}.png` for clipboard.
5. Insert `image` node with relative path `./assets/...`.
6. **Not in scope:** delete asset file when image node removed.

### PDF export

1. Reuse `markdownToHtml()` from `export-html.ts` (includes Mermaid via CDN).
2. Invoke Rust `export_pdf(html, output_path, options)`.
3. Rust: write temp HTML → hidden WebView load → platform PDF API:
   - macOS: WKWebView PDF generation
   - Windows/Linux: WebView2 print-to-PDF or equivalent
4. Save dialog for output path; progress indicator; readable error on failure.
5. Fallback message suggesting HTML export if platform PDF unavailable.

### Keyboard shortcuts (Phase 2 additions)

| Shortcut | Action |
|----------|--------|
| ⌘⇧O | Open folder |
| ⌘F | Find in document |
| ⌘⌥F | Replace in document |
| ⌘⇧E | Export PDF |

Existing shortcuts (⌘N/O/S, ⌘E HTML, ⌘⇧P, F8, ⌘\\) unchanged.

---

## Error Handling

- Rust commands return `Result<T, String>`; UI shows toast or status bar message.
- Rename/move: block if target exists.
- Delete: only `.md` files in Phase 2 (no directory delete).
- PDF failure: explicit error + HTML export suggestion.
- Image copy failure: do not insert broken node; show error.

---

## Testing

| Layer | Coverage |
|-------|----------|
| Rust unit | Tree filtering, path normalization, asset copy |
| Vitest | Outline extraction, find-replace logic, folder-workspace store |
| Playwright E2E (minimal) | Open folder → tree → open file → find → PDF smoke |
| Manual | macOS primary; Windows/Linux PDF spot-check |

---

## Delivery Milestones

1. **M1** — Folder open, tree browse, watch refresh, Recent fallback
2. **M2** — File CRUD: create, rename, delete, move, reveal
3. **M3** — Outline tab
4. **M4** — Find/replace bar
5. **M5** — Image paste/drop to assets
6. **M6** — PDF export (macOS first)
7. **M7** — Docs sync: Phase 1 plan checkboxes, verification notes, README

Recommended architecture: feature modules (not monolithic sidebar/store extension). Delivery follows milestone order for incremental validation.

---

## Out of Scope (Phase 2)

- Workspace-wide search across all `.md` files
- Math/LaTeX, footnotes, front matter, TOC generation
- Code syntax highlighting
- Spell check
- Multi-root workspaces
- Auto-delete image files when removed from document
- Project config files (`.makemd`)

---

## Phase 1 Retrospective (for doc sync)

Phase 1 implementation plan tasks 1–3 and 5 are complete. Task 4 is partial (core blocks + Mermaid + inline marks; missing math, footnotes, front matter, TOC, syntax highlight). Task 6 is partial (verification doc and README exist; Playwright E2E not implemented; cross-platform launch not rigorously verified).
