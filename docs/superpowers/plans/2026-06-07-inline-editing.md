# Inline Editing (Typora-Aligned) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Typora-class inline editing — live mark triggers, keyboard shortcuts, syntax hints while editing, shared syntax SSOT, paste support, and block shortcuts.

**Architecture:** `src/editor/inline-mark/` module owns syntax, input rules, keymap, decorations, paste; `inline-parser.ts` delegates tokenization; block rules extended in `input-rules.ts`.

**Tech Stack:** ProseMirror inputrules, keymap, decorations; Vue 3 editor shell unchanged.

**Spec:** `docs/superpowers/specs/2026-06-07-inline-editing-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `inline-mark/syntax.ts` | SSOT regex + tokenize |
| `inline-mark/guards.ts` | IME/code-block guards |
| `inline-mark/input-rules.ts` | mark InputRules |
| `inline-mark/keymap.ts` | ⌘B/I/E |
| `inline-mark/syntax-decorations.ts` | Typora delimiter hints |
| `inline-mark/paste.ts` | paste `**bold**` etc. |
| `inline-mark/plugin.ts` | wires plugins |
| `inline-parser.ts` | uses syntax SSOT |
| `input-rules.ts` | block + `---` + `- [ ]` |
| `plugins.ts` | registers inline-mark bundle |

---

## Status

Implemented in codebase. Tests: `tests/unit/inline-mark-editing.spec.ts`, `tests/unit/inline-marks.spec.ts`, existing round-trip tests.

**Completed (2026-06-07):**
- Link input rule `[text](url)` + ⌘K edit dialog
- `~~strikethrough~~` schema mark + input rule + decorations

## Follow-up (future specs)

- Rich link dialog (replace `window.prompt`)
- Math, footnotes, front matter
- prosemirror-markdown migration
