# Syntax Highlighting & Keyboard Shortcuts Design

**Date:** 2026-06-07  
**Status:** Approved  
**Supersedes:** Inline code default chord in `2026-06-07-inline-editing-design.md` (⌘E → ⌘⇧\`)  
**Goal:** Add fenced code-block syntax highlighting, inline code heuristic coloring, HTML export highlighting, a Typora-aligned configurable shortcut system, and a native menu bar that exposes the same commands.

---

## Problem

1. **Syntax:** Code fences render as monospace plain text; no token colors in editor or HTML export. Mermaid is the only special-case block.
2. **Shortcuts:** App shortcuts are hardcoded in `AppShell.vue`; editor shortcuts in `inline-mark/keymap.ts`. Several bindings conflict with Typora (⌘E, ⌘\\, ⌘⇧L). No user customization.
3. **Menu:** The desktop app has no application menu bar; features are only reachable via keyboard or command palette.

---

## Requirements (from brainstorming)

| Dimension | Decision |
|-----------|----------|
| Shortcut scope | Unified: app + editor formatting + code-block commands |
| Syntax highlight | Fenced blocks + inline heuristic tokens + HTML export |
| ⌘E conflict | Context routing: selection or inside mark → inline code; otherwise → export HTML |
| Customization | v1 settings page with persistence |
| Default keymap | Typora-aligned ([official reference](https://support.typora.io/Shortcut-Keys/)) |
| Inline code | Heuristic coloring (numbers, strings, keywords, operators) — no language detection |
| Menu | Typora-style menu bar listing the same commands with shortcut labels |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  App Menu (Tauri native / web fallback)                  │
│    items → commandId → registry.run(id)                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Settings UI (⌘,)                                       │
│    ↔ useShortcutsStore (localStorage overrides)         │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Shortcut Registry (Typora defaults + user overrides)    │
│    • app / editor / export commands                        │
│    • context rules (⌘E disambiguation)                     │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
     AppShell capture          ProseMirror keymap
                │                     │
┌───────────────▼─────────────────────▼───────────────────┐
│  Editor                                                    │
│    • block-commands (headings, lists, fence, table…)     │
│    • inline-mark (from registry)                           │
│    • code-block-view + syntax-highlight plugin            │
│    • inline-code-decorations (heuristic)                   │
└───────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  export-html.ts — highlight.js + theme CSS inline        │
└───────────────────────────────────────────────────────────┘
```

### Module boundaries

| Module | Responsibility |
|--------|----------------|
| `src/lib/shortcuts/registry.ts` | Command catalog: id, label, category, default chord, scope, handler |
| `src/lib/shortcuts/bindings.ts` | Parse/normalize KeyboardEvent ↔ chord string |
| `src/lib/shortcuts/context.ts` | Context rules for shared chords (⌘E) |
| `src/lib/shortcuts/dispatcher.ts` | Single entry: keyboard + menu → run command |
| `src/stores/shortcuts.ts` | Load/save overrides, conflict detection, reset |
| `src/components/SettingsPanel.vue` | Shortcut recording UI |
| `src/components/AppMenuBar.vue` | Web/dev fallback menu (hidden when native menu active) |
| `src-tauri/src/menu.rs` | Tauri native menu built from shared command manifest |
| `src/editor/syntax-highlight/` | Fence highlighting plugin + hljs theme CSS |
| `src/editor/inline-code-decorations.ts` | Inline heuristic token decorations |
| `src/editor/block-commands.ts` | Paragraph/format block operations |

**SSOT principle:** Every user-facing action has one `commandId`. Keyboard, menu, command palette, and settings all reference the same registry.

---

## Syntax highlighting

### Fenced code blocks

**Scope:** `code_block` nodes where `params` is not `mermaid` (case-insensitive).

**Approach:** highlight.js (recommended over CodeMirror embed — smaller, fits Typora WYSIWYG model).

**Rendering:**

1. Keep `code-block-view.ts` ProseMirror-editable `contentDOM` on `<code>`.
2. Add `syntax-highlight-plugin.ts`:
   - On doc change, collect non-mermaid `code_block` positions.
   - Debounce 150ms (300ms when doc >500 lines).
   - Call `hljs.highlight(code, { language })` with fence info string mapped via alias table (`ts`→`typescript`, `py`→`python`, etc.).
   - Inject read-only overlay `<div class="hljs-overlay">` inside wrapper; `pointer-events: none`; sync scroll with `<pre>`.
3. Cache highlight output by `(pos, textHash, language)`; only re-run when cache miss.

**Themes:** `hljs-light.css` / `hljs-dark.css` tied to `document.documentElement.dataset.theme`.

**Unknown language:** Fallback to `plaintext`; language badge still shown from raw info string.

### Inline code (heuristic)

Plugin `inline-code-decorations.ts` scans only inside `code` marks:

| Token | Rule | Class |
|-------|------|-------|
| string | `/(['"]).*?\1/` | `ic-str` |
| number | `/\b\d+(\.\d+)?\b/` | `ic-num` |
| keyword | Fixed ~30-word list (`if`, `else`, `return`, `const`, …) | `ic-kw` |
| operator | `/[=<>!+\-*\/&|]+/` | `ic-op` |

Priority: string > number > keyword > operator. Colors via CSS variables (`--ic-kw`, etc.) for light/dark.

**Not in scope:** Language detection, nested grammars, export-time inline tokenization.

### HTML export

Extend `export-html.ts`:

1. Non-mermaid fenced blocks: highlight with same highlight.js instance → `<pre><code class="hljs language-xxx">`.
2. Inline `<code>` tags: plain (no heuristic split in export v1).
3. Embed active theme hljs CSS in `<head>`.

### Dependency

Add `highlight.js`. Register common languages in a single `registerLanguages.ts` barrel (avoid shipping unused grammars if tree-shaking allows).

---

## Keyboard shortcuts

### Registry & persistence

- **Defaults:** Typora macOS table (see migration table below).
- **Overrides:** `localStorage` key `make-md:shortcuts` — `{ [commandId]: chord | null }`.
- **Settings:** ⌘, opens `SettingsPanel.vue`; categories mirror menu; record / reset per command.
- **Conflict UX:** Warn when rebinding steals an existing chord; user confirms swap or clear.

### ⌘E context routing

When chord `Mod-e` is pressed:

```
editor focused AND (non-empty selection OR cursor inside inline mark)
  → inline.toggleCode  (v1; Typora "Select Style Scope" can extend later)
otherwise
  → export.html
```

User may split into separate chords in settings.

### Migration from current make-md defaults

| Command | Typora default | make-md today | v1 default |
|---------|---------------|---------------|------------|
| Inline code | ⌘⇧\` | ⌘E | ⌘⇧\` |
| Export HTML | — | ⌘E | ⌘E (context rule) |
| Replace | ⌘H | ⌘⌥F | ⌘H |
| Clear format | ⌘\\ | — | ⌘\\ |
| Toggle sidebar | ⌘⇧L | ⌘\\ | ⌘⇧L |
| Toggle theme | — | ⌘⇧L | No default chord (settings button) |
| Open folder | — | ⌘⇧O | ⌘⇧O (keep) |
| Command palette | — | ⌘⇧P | ⌘⇧P (keep) |
| Preferences | ⌘, | — | ⌘, |

### Full default catalog (implement in registry)

**File:** New (⌘N), Open (⌘O), Open Folder (⌘⇧O), Save (⌘S), Save As (⌘⇧S), Close Tab (⌘W), Preferences (⌘,)

**Edit:** Undo/Redo (⌘Z/⌘⇧Z), Cut/Copy/Paste (⌘X/C/V), Find (⌘F), Find Next (⌘G), Find Previous (⌘⇧G), Replace (⌘H), Select All (⌘A)

**Paragraph:** Heading 1–6 (⌘1–6), Paragraph (⌘0), Increase/Decrease heading (⌘=/⌘-), Quote (⌘⌥Q), Ordered list (⌘⌥O), Unordered list (⌘⌥U), Code fence (⌘⌥C), Table (⌘⌥T), Indent/Outdent (⌘[/⌘]/Tab/⇧Tab)

**Format:** Bold (⌘B), Italic (⌘I), Underline (⌘U), Inline code (⌘⇧\`), Strikethrough (⌃⇧\`), Link (⌘K), Image (⌘⌃I), Clear format (⌘\\)

**View:** Toggle sidebar (⌘⇧L), Outline (⌘⌃1), Files tree focus (⌘⌃3), Focus mode (F8), Command palette (⌘⇧P)

**Export:** HTML (⌘E via context), PDF (⌘⇧E)

Commands for unsupported features (underline, image insert dialog, source mode) register as **disabled** menu items with `enabled: false` until implemented — keeps menu structure stable.

### Editor implementation

- `block-commands.ts`: ProseMirror commands for paragraph/format shortcuts.
- Replace hardcoded `AppShell.handleKeydown` with `shortcutDispatcher`.
- Replace `inline-mark/keymap.ts` static map with registry-generated keymap.
- `app-commands.ts` and command palette read display strings from registry.

---

## Application menu bar

Typora exposes every major action in the menu with shortcut hints on the right. make-md mirrors this structure.

### Desktop (Tauri) — primary

**File:** `src-tauri/src/menu.rs` builds native menu at startup.

- Menu structure matches registry categories (File / Edit / Paragraph / Format / View / Export).
- Each item stores `commandId` in Tauri menu item id.
- Accelerators set from effective chord (defaults + user overrides loaded via invoke on startup and on settings save).
- On menu event: emit to frontend → `shortcutDispatcher.run(commandId)`.

**Frontend hook:** `src/lib/menu-bridge.ts` listens for `menu://command` events and calls registry handlers. After shortcut override save, call `invoke('sync_menu_accelerators', { bindings })` to refresh native labels.

### Web / dev fallback

When `!isTauri()`, render `AppMenuBar.vue` fixed under title bar (macOS-style horizontal menu). Same categories and items; shortcuts shown as text; click → `run(commandId)`.

### Menu ↔ shortcut sync rules

1. Menu item label = registry `label`.
2. Menu accelerator = effective chord for platform (`Mod` → ⌘ on macOS, Ctrl on Win/Linux).
3. Disabled items: grayed, no accelerator, tooltip "Coming soon".
4. Command palette entries also sourced from registry (existing `createAppCommands` merges into registry or delegates to it).

### Menu items added for new capabilities

| Menu path | Command | Notes |
|-----------|---------|-------|
| Format → … | (existing marks) | Already partially available |
| Paragraph → Heading 1–6 | `paragraph.headingN` | New |
| Paragraph → Code Fences | `paragraph.codeFence` | New |
| View → Preferences… | `app.preferences` | Opens settings (shortcuts tab default) |
| Export → Export HTML / PDF | `export.html` / `export.pdf` | Move from implicit to explicit menu section |

---

## Error handling

| Case | Behavior |
|------|----------|
| highlight.js unknown language | Fallback `plaintext`; no user toast |
| highlight.js throws on malformed input | Skip overlay; show plain code |
| Large file debounce | Longer debounce; never block main thread >16ms per frame — batch blocks |
| Shortcut conflict on save | Block save until user resolves or confirms swap |
| Invalid recorded chord (modifier-only) | Ignore; show inline hint |
| Menu command while editor unavailable | App-scope commands still run; editor commands no-op if no active editor |
| Tauri menu sync failure | Log; keyboard/palette still work |

---

## Testing

**Unit (Vitest):**

- `bindings.ts`: chord parse/format round-trip
- `context.ts`: ⌘E routing cases (selection, mark, app focus)
- `shortcuts` store: override save, conflict detection, reset
- `inline-code-decorations`: token priority on sample strings
- `syntax-highlight`: language alias map, mermaid exclusion
- `block-commands`: heading level, list wrap, code fence insert

**Integration:**

- Registry → generated ProseMirror keymap fires expected transaction
- `export-html`: fenced block contains `hljs` classes

**Manual:**

- Toggle theme → hljs colors switch
- Edit JS fence → overlay tracks typing after debounce
- Settings: rebind ⌘B, verify menu accelerator + keymap + palette update
- macOS: native menu triggers save/export/format

**Regression:** Existing Vitest suite stays green.

---

## Out of scope

- User-defined syntax themes beyond light/dark hljs presets
- CodeMirror-style IDE editing inside fences
- Shiki / WASM highlighter
- Tauri-backed shortcut persistence (localStorage sufficient for v1)
- Typora "Select Style Scope" full parity (placeholder for ⌘E in-editor case beyond toggle code)
- Math block menu item enabled (disabled until math feature ships)
- Source code mode (⌘/)
- Windows/Linux accelerator QA beyond `Mod` normalization (best-effort)

---

## Success criteria

1. Fenced code blocks show syntax-colored overlay in editor for common languages.
2. Inline `` `code` `` shows heuristic token colors in editor.
3. HTML export includes hljs styling for fenced blocks matching editor theme at export time.
4. All Typora-catalog commands appear in menu with correct shortcut labels.
5. User can rebind shortcuts in settings; changes apply to keyboard, menu, and command palette without restart.
6. Default keymap matches Typora table except documented make-md extensions (open folder, command palette, export PDF).
