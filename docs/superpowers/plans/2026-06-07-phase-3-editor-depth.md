# Phase 3: Editor Depth & Performance

**Goal:** Close remaining Typora gaps from Phase 1 spec and improve large-document UX — without short-term hacks.

**Prerequisite:** Phase 2 workspace + inline-mark module complete.

---

## Priority order

| # | Feature | Rationale |
|---|---------|-----------|
| 1 | Large-file performance | Worker parse, debounced outline/Mermaid, virtualized scroll |
| 2 | Code syntax highlighting | Typora shows highlighted fences; uses same code_block node |
| 3 | Math (KaTeX) | `$inline$` and `$$block$$` in schema + input rules |
| 4 | Front matter | YAML block at doc top, preserved on save |
| 5 | Footnotes | `[^1]` refs + definition blocks |
| 6 | TOC generation | `@[toc]` or menu command from headings |

---

## Architecture notes

- **Performance:** Parse markdown off main thread; mount editor with placeholder then swap doc; lazy-render Mermaid on viewport intersection.
- **Syntax highlight:** CodeMirror 6 or highlight.js in code-block NodeView; language from fence info string.
- **Math:** `math_inline` / `math_block` nodes or atom marks; KaTeX render in NodeView/decoration.
- **Front matter:** Leading `yaml` code block or dedicated node stripped from outline/search.

---

## Out of scope (Phase 3)

- Workspace-wide search
- Spell check
- Multi-root workspaces
- Paid Typora features (license, cloud sync)

---

## Verification

- Unit: round-trip for each new block/mark type
- Manual: 10k+ line file scroll + outline click
- Regression: existing 36 Vitest tests green

## Progress

- **Mermaid lazy render (2026-06-07):** `IntersectionObserver` in `mermaid-plugin.ts` — diagrams render only when near viewport; placeholder off-screen.
