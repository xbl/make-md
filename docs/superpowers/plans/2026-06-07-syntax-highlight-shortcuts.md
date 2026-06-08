# Syntax Highlighting & Keyboard Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship fenced code-block syntax highlighting (editor + HTML export), inline code heuristic coloring, a Typora-aligned configurable shortcut registry with settings UI, and native/web menu bars wired to the same command catalog.

**Architecture:** Add `highlight.js` via a ProseMirror decoration overlay plugin on existing `code-block-view.ts`; heuristic inline decorations in a separate plugin. Centralize all user actions in `src/lib/shortcuts/` with Pinia persistence; replace hardcoded key handlers in `AppShell.vue` and `inline-mark/keymap.ts` with a dispatcher. Tauri native menu in Rust emits command IDs to the frontend; web dev uses `AppMenuBar.vue`.

**Tech Stack:** highlight.js, ProseMirror plugins/decorations, Pinia, Vue 3, Tauri 2 menu API, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-syntax-highlight-shortcuts-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/editor/syntax-highlight/languages.ts` | Language alias map + hljs registration |
| `src/editor/syntax-highlight/plugin.ts` | Debounced fence overlay sync |
| `src/editor/syntax-highlight/themes/*.css` | hljs light/dark CSS |
| `src/editor/inline-code-decorations.ts` | Heuristic token decorations in `code` marks |
| `src/lib/shortcuts/types.ts` | `CommandDef`, `CommandScope`, chord types |
| `src/lib/shortcuts/bindings.ts` | Event ↔ chord string |
| `src/lib/shortcuts/context.ts` | ⌘E disambiguation |
| `src/lib/shortcuts/registry.ts` | Typora default catalog + handler wiring |
| `src/lib/shortcuts/dispatcher.ts` | Keyboard/menu → run |
| `src/lib/shortcuts/display.ts` | Chord → `⌘⇧K` display string |
| `src/lib/menu-bridge.ts` | Tauri menu event listener |
| `src/lib/commands/manifest.json` | Shared menu metadata for Rust (ids, labels, categories) |
| `src/stores/shortcuts.ts` | Overrides + conflict detection |
| `src/stores/ui.ts` | Add `settingsOpen` |
| `src/editor/block-commands.ts` | Heading/list/fence/table PM commands |
| `src/components/SettingsPanel.vue` | Shortcut recording UI |
| `src/components/AppMenuBar.vue` | Web fallback menu |
| `src-tauri/src/menu.rs` | Native menu build + emit |
| `src/lib/export-html.ts` | hljs in export |
| `src/layout/AppShell.vue` | Dispatcher + settings + menu mount |
| `src/editor/plugins.ts` | Register new editor plugins |
| `src/styles/app.css` | Overlay + inline token + menu/settings styles |

---

### Task 1: highlight.js foundation

**Files:**
- Create: `src/editor/syntax-highlight/languages.ts`
- Create: `tests/unit/syntax-highlight-languages.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install highlight.js**

Run: `pnpm add highlight.js`

- [ ] **Step 2: Write failing test for language alias**

```ts
// tests/unit/syntax-highlight-languages.spec.ts
import { describe, it, expect } from "vitest";
import { resolveHighlightLanguage, isMermaidLanguage } from "@/editor/syntax-highlight/languages";

describe("resolveHighlightLanguage", () => {
  it("maps common aliases", () => {
    expect(resolveHighlightLanguage("ts")).toBe("typescript");
    expect(resolveHighlightLanguage("js")).toBe("javascript");
    expect(resolveHighlightLanguage("py")).toBe("python");
  });

  it("falls back to plaintext for unknown", () => {
    expect(resolveHighlightLanguage("not-a-lang")).toBe("plaintext");
  });

  it("excludes mermaid", () => {
    expect(isMermaidLanguage("mermaid")).toBe(true);
    expect(isMermaidLanguage("Mermaid")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/syntax-highlight-languages.spec.ts -v`  
Expected: FAIL — module not found

- [ ] **Step 4: Implement languages.ts**

```ts
// src/editor/syntax-highlight/languages.ts
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import markdown from "highlight.js/lib/languages/markdown";

const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  html: "xml",
  yml: "yaml",
};

let registered = false;

export function ensureHighlightLanguagesRegistered() {
  if (registered) return;
  [javascript, typescript, python, rust, bash, json, xml, css, markdown].forEach((lang) =>
    hljs.registerLanguage(lang.name, lang),
  );
  registered = true;
}

export function resolveHighlightLanguage(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (!trimmed) return "plaintext";
  const mapped = ALIASES[trimmed] ?? trimmed;
  ensureHighlightLanguagesRegistered();
  return hljs.getLanguage(mapped) ? mapped : "plaintext";
}

export function isMermaidLanguage(raw: string | null | undefined): boolean {
  return (raw ?? "").trim().toLowerCase() === "mermaid";
}

export function highlightCode(text: string, language: string): string {
  ensureHighlightLanguagesRegistered();
  try {
    if (language === "plaintext") {
      return hljs.highlight(text, { language: "plaintext" }).value;
    }
    return hljs.highlight(text, { language }).value;
  } catch {
    return hljs.highlight(text, { language: "plaintext" }).value;
  }
}

export { hljs };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/syntax-highlight-languages.spec.ts -v`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/editor/syntax-highlight/languages.ts tests/unit/syntax-highlight-languages.spec.ts
git commit -m "feat: add highlight.js language registry"
```

---

### Task 2: Fenced block syntax overlay plugin

**Files:**
- Create: `src/editor/syntax-highlight/plugin.ts`
- Create: `src/editor/syntax-highlight/themes/hljs-light.css`
- Create: `src/editor/syntax-highlight/themes/hljs-dark.css`
- Modify: `src/editor/code-block-view.ts`
- Modify: `src/editor/plugins.ts`
- Modify: `src/styles/app.css`
- Create: `tests/unit/syntax-highlight-plugin.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { collectCodeBlocksForHighlight } from "@/editor/syntax-highlight/plugin";
import { markdownSchema } from "@/editor/schema";

describe("collectCodeBlocksForHighlight", () => {
  it("skips mermaid blocks", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("code_block", { params: "mermaid" }, [markdownSchema.text("graph TD")]),
      markdownSchema.node("code_block", { params: "js" }, [markdownSchema.text("const x = 1")]),
    ]);
    const blocks = collectCodeBlocksForHighlight(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("javascript");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm vitest run tests/unit/syntax-highlight-plugin.spec.ts -v`

- [ ] **Step 3: Implement plugin + export `collectCodeBlocksForHighlight`**

Key behaviors in `plugin.ts`:
- Export `collectCodeBlocksForHighlight(doc)` returning `{ pos, text, language, nodeSize }[]`
- Plugin `view()` hook: on doc change, debounce 150ms (300ms if doc.content.size > 500 lines proxy)
- For each block, find `.code-block-wrapper[data-language]` via `view.nodeDOM(pos)` and set/update `.hljs-overlay` innerHTML from `highlightCode`
- Sync scroll: listen `scroll` on `<pre>` and mirror to overlay

Update `code-block-view.ts` `createCodeBlockNodeView` to append empty `<div class="hljs-overlay" aria-hidden="true">` sibling inside wrapper.

Add to `app.css`:

```css
.editor-view .ProseMirror .code-block-wrapper { position: relative; }
.editor-view .ProseMirror .code-block-wrapper pre { position: relative; z-index: 1; background: transparent; }
.editor-view .ProseMirror .hljs-overlay {
  position: absolute; inset: 0; padding: 10px 12px; pointer-events: none;
  overflow: hidden; white-space: pre; font: inherit; z-index: 0;
}
.editor-view .ProseMirror .code-block-wrapper pre code { color: transparent; caret-color: var(--code-text); }
```

Import hljs theme CSS in `src/main.ts` based on theme dataset.

Register plugin in `plugins.ts` after `createMermaidPlugin()`.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/syntax-highlight-plugin.spec.ts -v`  
Expected: PASS

- [ ] **Step 5: Manual smoke**

Run: `pnpm tauri dev` → insert ` ```js ` block with `const foo = "bar"` → colored overlay after pause.

- [ ] **Step 6: Commit**

```bash
git add src/editor/syntax-highlight src/editor/code-block-view.ts src/editor/plugins.ts src/styles/app.css src/main.ts tests/unit/syntax-highlight-plugin.spec.ts
git commit -m "feat: syntax highlight overlay for code fences"
```

---

### Task 3: Inline code heuristic decorations

**Files:**
- Create: `src/editor/inline-code-decorations.ts`
- Modify: `src/editor/plugins.ts`
- Modify: `src/styles/app.css`
- Create: `tests/unit/inline-code-decorations.spec.ts`

- [ ] **Step 1: Write failing test for token priority**

```ts
import { describe, it, expect } from "vitest";
import { tokenizeInlineCodeHeuristic } from "@/editor/inline-code-decorations";

describe("tokenizeInlineCodeHeuristic", () => {
  it("classifies string before keyword", () => {
    const tokens = tokenizeInlineCodeHeuristic('"if"');
    expect(tokens[0]).toEqual({ from: 0, to: 4, kind: "string" });
  });

  it("classifies numbers and keywords", () => {
    const tokens = tokenizeInlineCodeHeuristic("return 42");
    expect(tokens.some((t) => t.kind === "keyword" && t.text === "return")).toBe(true);
    expect(tokens.some((t) => t.kind === "number")).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement plugin**

Export `tokenizeInlineCodeHeuristic(text: string)` with priority string > number > keyword > operator.

ProseMirror plugin builds `Decoration.inline` with classes `ic-str`, `ic-num`, `ic-kw`, `ic-op` scanning `code` mark ranges only.

CSS variables in `app.css`:

```css
:root { --ic-kw: #0550ae; --ic-str: #0a7; --ic-num: #953800; --ic-op: #57606a; }
[data-theme="dark"] { --ic-kw: #79c0ff; --ic-str: #7ee787; --ic-num: #ffa657; --ic-op: #8b949e; }
.ic-kw { color: var(--ic-kw); }
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: heuristic inline code token decorations"
```

---

### Task 4: HTML export highlighting

**Files:**
- Modify: `src/lib/export-html.ts`
- Modify: `src/stores/ui.ts` (export reads theme)
- Create: `tests/unit/export-html-highlight.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { markdownToHtml } from "@/lib/export-html";

describe("markdownToHtml highlight", () => {
  it("wraps fenced js with hljs classes", () => {
    const html = markdownToHtml("```js\nconst x = 1\n```", "Test");
    expect(html).toContain('class="hljs');
    expect(html).toContain("<style>");
  });

  it("leaves mermaid as pre.mermaid", () => {
    const html = markdownToHtml("```mermaid\ngraph TD\n```", "Test");
    expect(html).toContain('class="mermaid"');
    expect(html).not.toContain('class="hljs language-mermaid"');
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Update export-html.ts**

In `marked` renderer `code()` branch: if lang is mermaid → existing; else use `highlightCode(text, resolveHighlightLanguage(lang))` and emit `<pre><code class="hljs language-...">`.

Add helper `getHighlightThemeCss(theme: 'light'|'dark'): string` importing raw CSS strings from theme files (or read at build via `?inline`).

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: highlight fenced code in HTML export"
```

---

### Task 5: Shortcut bindings + types

**Files:**
- Create: `src/lib/shortcuts/types.ts`
- Create: `src/lib/shortcuts/bindings.ts`
- Create: `src/lib/shortcuts/display.ts`
- Create: `tests/unit/shortcut-bindings.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { eventToChord, chordToDisplay } from "@/lib/shortcuts/bindings";

describe("eventToChord", () => {
  it("normalizes mac meta chords", () => {
    const event = new KeyboardEvent("keydown", { key: "b", metaKey: true });
    expect(eventToChord(event)).toBe("Mod-b");
  });

  it("records shift-backtick as Mod-Shift-Backquote", () => {
    const event = new KeyboardEvent("keydown", { key: "`", metaKey: true, shiftKey: true });
    expect(eventToChord(event)).toBe("Mod-Shift-Backquote");
  });
});

describe("chordToDisplay", () => {
  it("shows mac symbols", () => {
    expect(chordToDisplay("Mod-Shift-e", "darwin")).toBe("⌘⇧E");
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement bindings.ts + display.ts**

`eventToChord(event: KeyboardEvent): string | null` — return null for bare keys without Mod; map `key` to stable names (`Backquote`, `BracketLeft`, etc.).

`matchesChord(event, chord: string): boolean` for dispatcher.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: shortcut chord parsing and display helpers"
```

---

### Task 6: Command registry + context rules

**Files:**
- Create: `src/lib/shortcuts/context.ts`
- Create: `src/lib/shortcuts/registry.ts`
- Create: `src/lib/commands/manifest.json`
- Create: `tests/unit/shortcut-context.spec.ts`
- Create: `tests/unit/shortcut-registry.spec.ts`

- [ ] **Step 1: Write failing context test**

```ts
import { describe, it, expect } from "vitest";
import { resolveModECommand } from "@/lib/shortcuts/context";

describe("resolveModECommand", () => {
  it("routes to inline code when selection non-empty", () => {
    expect(resolveModECommand({ editorFocused: true, hasSelection: true, inInlineMark: false }))
      .toBe("format.inlineCode");
  });

  it("routes to export when editor focused without selection", () => {
    expect(resolveModECommand({ editorFocused: true, hasSelection: false, inInlineMark: false }))
      .toBe("export.html");
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement registry**

`registry.ts` exports:
- `COMMAND_CATALOG: CommandDef[]` with all spec commands (id, label, category, defaultChord, scope, enabled)
- `createCommandHandlers(deps): Record<string, () => void | Promise<void>>` — deps injected from stores
- Default chords per spec migration table (inline code `Mod-Shift-Backquote`, replace `Mod-h`, sidebar `Mod-Shift-l`, etc.)

`manifest.json` mirrors ids/labels/categories/enabled for Rust menu (no handlers).

`context.ts` implements `resolveModECommand` and generic `resolveChord(chord, ctx)` when multiple commands share chord.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: typora-aligned command registry and Mod-e routing"
```

---

### Task 7: Shortcuts store + dispatcher

**Files:**
- Create: `src/stores/shortcuts.ts`
- Create: `src/lib/shortcuts/dispatcher.ts`
- Create: `tests/unit/shortcuts-store.spec.ts`

- [ ] **Step 1: Write failing store test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useShortcutsStore } from "@/stores/shortcuts";

describe("useShortcutsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("detects chord conflicts", () => {
    const store = useShortcutsStore();
    const conflict = store.checkConflict("format.bold", "Mod-b");
    expect(conflict).toBeNull();
    store.applyOverride("format.bold", "Mod-k");
    expect(store.checkConflict("format.link", "Mod-k")?.commandId).toBe("format.bold");
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement store + dispatcher**

Store:
- `overrides: Record<string, string | null>` persisted to `make-md:shortcuts`
- `effectiveChord(commandId)`, `applyOverride`, `resetCommand`, `resetAll`, `checkConflict`
- `getChordMap(): Record<string, string>` for menu sync

Dispatcher:
- `createShortcutDispatcher(handlers)` with `handleKeydown(event)` and `run(commandId)`
- Looks up chord → command; applies context resolver for ambiguous chords
- Editor-scope commands require `useEditorStore().view`

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: shortcut overrides store and dispatcher"
```

---

### Task 8: Block commands + editor keymap from registry

**Files:**
- Create: `src/editor/block-commands.ts`
- Modify: `src/editor/inline-mark/keymap.ts`
- Modify: `src/editor/plugins.ts`
- Create: `tests/unit/block-commands.spec.ts`

- [ ] **Step 1: Write failing block command test**

```ts
import { describe, it, expect } from "vitest";
import { setHeadingLevel } from "@/editor/block-commands";
import { markdownSchema } from "@/editor/schema";
import { EditorState } from "prosemirror-state";

describe("setHeadingLevel", () => {
  it("converts paragraph to heading 2", () => {
    const doc = markdownSchema.node("doc", null, [markdownSchema.node("paragraph", null, [markdownSchema.text("Hi")])]);
    const state = EditorState.create({ schema: markdownSchema, doc });
    const tr = setHeadingLevel(2)(state, state.tr);
    expect(tr.doc.firstChild?.type.name).toBe("heading");
    expect(tr.doc.firstChild?.attrs.level).toBe(2);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement block-commands.ts**

Commands: `setHeadingLevel(n)`, `setParagraph`, `wrapBlockquote`, `toggleBulletList`, `toggleOrderedList`, `insertCodeFence`, `insertTable3x3`, `increaseHeading`, `decreaseHeading`, `clearFormatting`.

Refactor `inline-mark/keymap.ts` → `createInlineMarkKeymap(schema, getChordForCommand)` using registry chords instead of hardcoded `Mod-e` for code (use `Mod-Shift-Backquote`).

Add `createRegistryKeymap(schema, chordMap)` in `plugins.ts` merging block + inline maps.

- [ ] **Step 4: Run — PASS + full unit suite**

Run: `pnpm test`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: block formatting commands and registry-driven editor keymap"
```

---

### Task 9: Wire AppShell + command palette to dispatcher

**Files:**
- Modify: `src/layout/AppShell.vue`
- Modify: `src/lib/app-commands.ts`
- Modify: `src/components/CommandPalette.vue`
- Modify: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Replace `handleKeydown` in AppShell**

Remove hardcoded shortcut branches; call `dispatcher.handleKeydown(event)` on `window` capture phase.

Initialize dispatcher in `onMounted` with handlers from `createCommandHandlers({ documents, ui, folderWorkspace, editorStore })`.

Add F8 handling inside registry (`view.focusMode`).

- [ ] **Step 2: Refactor app-commands.ts**

Export `getPaletteCommands()` reading from `COMMAND_CATALOG` filtered to enabled + app/export/view scopes; shortcut labels from `useShortcutsStore().effectiveChord`.

- [ ] **Step 3: Update README shortcut table** (migration notes)

- [ ] **Step 4: Run tests**

Run: `pnpm test && pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor: route app shortcuts through dispatcher"
```

---

### Task 10: Settings panel UI

**Files:**
- Create: `src/components/SettingsPanel.vue`
- Modify: `src/stores/ui.ts`
- Modify: `src/layout/AppShell.vue`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Add `settingsOpen` to ui store**

Actions: `openSettings()`, `closeSettings()`, `toggleSettings()`.

- [ ] **Step 2: Build SettingsPanel.vue**

Modal/sheet with category sidebar; list commands with current chord (`chordToDisplay`), Record button (keydown capture → `eventToChord`), Reset per row, Reset all.

On conflict: show confirm dialog (swap or cancel).

On save: `shortcutsStore.applyOverride` + emit `shortcuts-changed` for menu sync.

Theme toggle button here (no default chord).

- [ ] **Step 3: Mount in AppShell**

`<SettingsPanel v-if="ui.settingsOpen" @close="ui.closeSettings()" />`

Wire `app.preferences` command to `ui.openSettings()`.

- [ ] **Step 4: Manual test**

⌘, opens panel; rebind ⌘B; verify bold still works with new chord.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: settings panel for shortcut customization"
```

---

### Task 11: Tauri native menu

**Files:**
- Create: `src-tauri/src/menu.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml` (enable `menu` feature if needed)
- Create: `src/lib/menu-bridge.ts`

- [ ] **Step 1: Enable Tauri menu feature**

In `Cargo.toml`: `tauri = { version = "2.11.2", features = ["menu"] }`

- [ ] **Step 2: Implement menu.rs**

```rust
// Build Submenu per category from manifest.json embedded at compile time (include_str!)
// MenuItem id = command_id
// Accelerator from optional string like "CmdOrCtrl+N"
// Disabled items when enabled=false in manifest
// on_menu_event: window.emit("menu-command", command_id)
```

Add command `sync_menu_accelerators` accepting JSON bindings to rebuild menu (or update items).

- [ ] **Step 3: menu-bridge.ts**

```ts
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";

export function setupMenuBridge(run: (commandId: string) => void) {
  if (!isTauri()) return () => {};
  const unlisten = listen<string>("menu-command", (e) => run(e.payload));
  return unlisten;
}
```

Call from AppShell after dispatcher init; on shortcuts save invoke `sync_menu_accelerators`.

- [ ] **Step 4: Manual test (macOS)**

File → Save from menu saves document; Format → Bold works with editor focused.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: tauri native menu wired to command registry"
```

---

### Task 12: Web AppMenuBar fallback

**Files:**
- Create: `src/components/AppMenuBar.vue`
- Modify: `src/layout/AppShell.vue`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Implement AppMenuBar.vue**

Horizontal menu from `COMMAND_CATALOG` grouped by category; show `chordToDisplay`; disabled styling; dropdown on click.

Only render when `!isTauri()`.

- [ ] **Step 2: Adjust AppShell layout**

Add top padding when web menu visible.

- [ ] **Step 3: Manual test in browser**

Run: `pnpm dev` → menu visible → Save/New work.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: web fallback menu bar for dev mode"
```

---

### Task 13: Integration tests, docs, regression

**Files:**
- Modify: `tests/unit/inline-mark-editing.spec.ts` (update ⌘E → Mod-Shift-Backquote for inline code)
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-06-07-typora-desktop-editor.md` (status row)
- Modify: `docs/superpowers/plans/2026-06-07-phase-3-editor-depth.md`

- [ ] **Step 1: Fix tests referencing old Mod-e inline code**

Update keymap tests to use `Mod-Shift-Backquote`.

- [ ] **Step 2: Run full verification**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: all pass

- [ ] **Step 3: Update README**

Document new shortcuts, settings (⌘,), menu structure, syntax highlight note.

- [ ] **Step 4: Update phase plans status**

Mark syntax highlight + shortcuts as planned/in progress in phase-3 doc.

- [ ] **Step 5: Commit**

```bash
git commit -m "docs: update README and plans for syntax highlight and shortcuts"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Fenced hljs overlay | Task 2 |
| Inline heuristic decorations | Task 3 |
| HTML export hljs | Task 4 |
| Typora default keymap | Task 6 |
| ⌘E context routing | Task 6–7 |
| Settings + persistence | Task 7, 10 |
| Block/paragraph shortcuts | Task 8 |
| Dispatcher replaces hardcoded | Task 9 |
| Command palette from registry | Task 9 |
| Tauri native menu | Task 11 |
| Web menu fallback | Task 12 |
| Disabled menu items for unimplemented | Task 6, 11 |
| Theme-synced hljs CSS | Task 2, 4 |
| Tests per spec | Tasks 1–8, 13 |

---

## Manual verification checklist

- [ ] JS/Python fence colors update while typing (150ms debounce)
- [ ] Mermaid unchanged (no hljs overlay)
- [ ] Inline `` `return 42` `` shows colored tokens
- [ ] HTML export contains hljs CSS + colored fence
- [ ] ⌘, opens settings; rebind persists after reload
- [ ] Menu accelerators match settings (Tauri)
- [ ] ⌘E exports when no selection; toggles code with selection
- [ ] ⌘⇧\` toggles inline code by default
- [ ] ⌘H opens replace (not ⌘⌥F)
