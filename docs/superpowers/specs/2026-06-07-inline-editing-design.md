# Inline Editing Design (Typora-Aligned)

**Date:** 2026-06-07  
**Status:** Approved  
**Goal:** Match or exceed Typora’s hybrid inline editing — live Markdown triggers, keyboard marks, syntax visibility while editing, and shared syntax logic for parse / paste / serialize.

---

## Problem

Inline marks work on **file load/save** but not **while typing**. Block shortcuts (`#`, `-`, `>`) work; `**bold**` does not. No ⌘B/⌘I/⌘E. README overstates current UX.

---

## Typora parity target (long-term north star)

| Capability | Typora | make-md target |
|------------|--------|----------------|
| `**bold**` / `*italic*` / `` `code` `` on type | ✓ | ✓ |
| ⌘B / ⌘I / ⌘E / ⌘K | ✓ | ✓ (K = link, phased) |
| Syntax visible only while cursor in mark | ✓ | ✓ (decoration + CSS) |
| Paste inline Markdown | ✓ | ✓ (shared syntax) |
| `- [ ]` task, `---` hr block triggers | ✓ | ✓ |
| `~~strike~~`, math, footnotes | ✓ | strike ✓; math/footnotes later |
| Hide syntax on blur / show on focus in mark | ✓ | ✓ |

**Principle:** One syntax module drives parser, input rules, paste, and decoration — no duplicate regex drift.

---

## Architecture (durable)

```
src/editor/inline-mark/
  syntax.ts              # delimiter patterns, tokenize helper (SSOT)
  guards.ts              # IME, code_block, code mark
  input-rules.ts         # mark InputRules
  keymap.ts              # ⌘B / ⌘I / ⌘E
  syntax-decorations.ts  # active-mark delimiter hints (Typora hybrid)
  paste.ts               # paste plain-text markdown spans
  plugin.ts              # registers all of the above

src/editor/inline-parser.ts   # delegates tokenization to inline-mark/syntax.ts
src/editor/input-rules.ts     # block rules + re-export or compose inline via plugin
src/editor/plugins.ts         # createInlineMarkPlugin()
```

Document model stays **mark-based** (not literal `**` in PM doc). Serializer continues emitting `**` on save.

---

## Components

### 1. Shared syntax (`syntax.ts`)

Export patterns and `tokenizeInlineLine(text)` used by:
- `inline-parser.ts` (open file)
- `input-rules.ts` (live typing)
- `paste.ts` (clipboard)

### 2. Input rules

On closing delimiter: remove wrappers, apply mark, support `undoInputRule`.

Marks: **strong**, *em*, `code`. Guards in `guards.ts`.

### 3. Keymap

| Shortcut | Action |
|----------|--------|
| ⌘B | toggleMark(strong) |
| ⌘I | toggleMark(em) |
| ⌘E | toggleMark(code) |

Empty selection: wrap word at cursor if Typora-like word boundary exists, else no-op (match Typora for CJK: toggle at cursor position when possible).

### 4. Syntax decorations (Typora hybrid)

Plugin state: ranges where cursor intersects a mark.

`Decoration.inline` adds class e.g. `pm-mark-editing pm-mark-editing--strong`.

CSS `::before` / `::after` render grey `**` / `*` / `` ` `` — not in document, not saved.

Updates on selection change; disabled during IME composition.

### 5. Paste handler

If clipboard is plain text matching inline patterns, parse via `syntax.ts` and insert marked nodes instead of raw text.

### 6. Block rules (same release)

Extend `input-rules.ts`:
- `- [ ]` / `- [x]` → task_item
- `---` on own line → horizontal_rule

---

## Out of scope (future specs)

- Rich link dialog (replace `window.prompt` for ⌘K)
- Math, footnotes, front matter
- prosemirror-markdown migration

---

## Testing

- Unit: syntax tokenize, input rules, keymap, decoration ranges, paste
- Regression: markdown-roundtrip, block input rules
- Manual: type `**x**`, blur → bold only; click inside → see `**`; ⌘B; save file

---

## Success criteria

- Typora-like: type `**文字**` → bold; cursor inside shows delimiter hints; save → `**文字**`
- ⌘B/⌘I/⌘E work on selection
- Paste `**a**` applies mark
- `- [ ]` and `---` work at line start
- Single syntax SSOT — no divergent regex in parser vs editor
