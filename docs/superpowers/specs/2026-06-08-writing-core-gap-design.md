# Writing Core Gap Design

**Date:** 2026-06-08  
**Status:** Draft for review  
**Scope:** Identify the missing foundational writing and editing capabilities needed for `make-md` to feel like a daily-use Markdown editor in the Typora / Obsidian class, then define a practical delivery order.

---

## Goal

`make-md` already covers the basic shell of a desktop Markdown editor: rich editing, files, outline, search, export, and recovery. The remaining gap is not a single flagship feature. It is the set of baseline editing capabilities that users assume exist in a serious Markdown writing tool.

This spec defines those missing capabilities, groups them by urgency, and proposes an implementation sequence that improves day-to-day writing usefulness as quickly as possible.

---

## Product Standard

The comparison target is not "can it edit Markdown at all?".

The comparison target is:

1. Can a user write normal long-form Markdown without hitting obvious workflow gaps?
2. Can a user perform common structural editing actions without switching tools or hand-editing raw syntax?
3. Does the editor cover the expected writing primitives for notes, docs, blog posts, and technical articles?

This standard includes both:

- Markdown structure features
- writing-flow usability features

---

## Current State Summary

The current product is already strong in:

- WYSIWYG Markdown editing
- block shortcuts and inline formatting
- folder/file workflow
- outline sidebar
- find and replace
- image paste/drop
- export HTML / PDF / Word
- autosave and recovery

The main gap is that several expected writing primitives are either missing outright or only partially wired through runtime commands and UI entry points.

---

## Missing Foundation

### P0: Must-have editing baseline

These are the highest-priority missing pieces. Without them, `make-md` still feels incomplete as a daily-use Markdown editor.

#### 1. Image insertion entry point

Current state:

- image paste works
- image drag/drop works
- explicit insert-image command / picker is still missing

Why this is foundational:

- users expect to insert an image intentionally, not only through clipboard or file drag
- menu and command palette parity matter in desktop writing tools

Minimum acceptable delivery:

- menu action
- command palette action
- file picker
- insert image into current cursor position using existing asset path logic

#### 2. Table insertion entry point

Current state:

- table model and parsing exist
- insertion command remains disabled

Why this is foundational:

- tables are a standard Markdown writing primitive
- "supports tables" is not credible if users cannot insert one from the app

Minimum acceptable delivery:

- insert table action
- basic dimensions input or a small default table
- wiring through runtime command system

#### 3. Paragraph structure command closure

Current state:

- quote / ordered list / unordered list / heading level adjustment are still partial

Why this is foundational:

- structure-changing commands are basic editor affordances
- users should not see commands in menus that do not behave reliably

Minimum acceptable delivery:

- quote command fully works
- ordered list command fully works
- unordered list command fully works
- increase/decrease heading level fully works
- behavior is consistent across menu, shortcuts, and command palette

#### 4. Front matter editing

Why this is foundational:

- many Markdown workflows use YAML front matter for title, tags, date, slug, publish flags, metadata
- technical writers and static-site users expect this as table stakes

Minimum acceptable delivery:

- parse and preserve front matter
- editable representation in the app
- round-trip safety

#### 5. Footnotes

Why this is foundational:

- common in technical docs, essays, long-form notes, and reference-heavy writing

Minimum acceptable delivery:

- parse footnotes
- edit without breaking structure
- serialize back correctly

#### 6. TOC support

Why this is foundational:

- long-form Markdown often relies on generated tables of contents
- users expect either a TOC token or a TOC block mechanism

Minimum acceptable delivery:

- support `[TOC]` or one explicit TOC block format
- preserve behavior through parsing and serialization
- keep export output predictable

### P1: Strongly expected daily writing features

These do not block basic editing, but users will quickly notice their absence in regular writing sessions.

#### 1. Word / character / reading-time statistics

Why it matters:

- one of the most common writing feedback loops
- especially important for notes, articles, and documentation work

#### 2. Better link workflow

Why it matters:

- links are central to Markdown writing
- insertion alone is not enough; editing and opening should also feel direct

Expected scope:

- smoother insert/edit flow
- open link behavior
- relative-path assistance where practical

#### 3. Table editing ergonomics

Why it matters:

- insertion alone is not enough for real use
- without row/column actions and keyboard movement, tables remain a nominal feature

Expected scope:

- add/remove row
- add/remove column
- cell navigation with keyboard

#### 4. Stronger outline coupling

Why it matters:

- the outline exists, but daily writing benefits from more active synchronization

Expected scope:

- highlight current heading
- better long-document tracking behavior

#### 5. Search/replace polish

Why it matters:

- feature exists already
- a mature editor benefits from stronger interaction details and better match feedback

### P2: Important, but not first-wave foundation

These matter, but should not preempt the missing baseline above.

- math blocks
- tighter export fidelity, especially syntax highlighting parity
- stronger source/WYSIWYG consistency
- full AI rewrite interaction closure
- templates / snippets / common block insertion

---

## Delivery Approaches

### Approach A: Markdown-structure-first

Order:

- front matter
- footnotes
- TOC
- math

Pros:

- improves formal Markdown completeness
- strong for publishing and technical-document workflows

Cons:

- does not immediately fix the most visible daily-use gaps

### Approach B: Writing-flow-first

Order:

- image insertion
- table insertion
- paragraph command closure
- stats

Pros:

- fastest visible improvement in day-to-day usability
- removes "why is this missing?" moments quickly

Cons:

- leaves formal Markdown feature gaps open longer

### Approach C: Mixed baseline-first

Order:

1. image insertion
2. table insertion
3. paragraph command closure
4. front matter
5. footnotes
6. TOC
7. word statistics
8. table ergonomics
9. link workflow
10. math blocks

Pros:

- balances immediate usability and Markdown completeness
- establishes a stronger product floor before moving to polish

Cons:

- spans more subsystems, so sequencing discipline matters

### Recommendation

Choose **Approach C**.

Reason:

- the biggest current problem is not one advanced missing feature
- the product needs the missing "obvious basics" first
- after the command and insertion gaps are closed, formal writing features like front matter, footnotes, and TOC become the next strongest baseline upgrades

---

## Proposed Phases

### Phase A: Editing closure

Scope:

- image insertion entry point
- table insertion entry point
- quote/list/heading runtime closure

Success condition:

- users can perform standard structural edits from visible UI/command affordances without falling back to manual raw Markdown edits

### Phase B: Markdown writing completeness

Scope:

- front matter
- footnotes
- TOC

Success condition:

- the editor supports the expected document-structure primitives for technical notes, blog posts, and article-style Markdown

### Phase C: Daily writing comfort

Scope:

- word/character/reading-time stats
- table ergonomics
- improved link workflow
- stronger outline coupling

Success condition:

- the editor feels noticeably better in real multi-hour writing sessions, not just feature-checklist complete

---

## Boundaries

This spec does not include:

- sync
- collaboration
- backlinks / graph features
- publishing pipelines
- plugin systems
- large-scale AI editing expansion

Those may matter later, but they are not part of the current "foundational writing core" gap.

---

## Risks

### Risk 1: Mixing baseline and polish work

If table ergonomics or AI polish starts before insertion and command closure are finished, delivery will look busy but still feel incomplete.

Mitigation:

- complete P0 baseline items before expanding into comfort features

### Risk 2: Over-scoping Markdown completeness

If front matter, footnotes, TOC, and math are tackled together as one large effort, progress may stall.

Mitigation:

- keep each feature independently shippable
- preserve parse/edit/serialize boundaries

### Risk 3: UI entry points diverge from command/runtime support

This already exists in partial areas today.

Mitigation:

- require every feature to ship with aligned menu, command, runtime, and test coverage where applicable

---

## Testing Expectations

Each phase should include:

- parser / serializer tests for syntax-bearing features
- editor command tests for runtime actions
- component tests for visible entry points
- focused end-to-end checks for critical writing flows

Examples:

- insert image from picker into active document
- insert table from command entry point
- toggle quote/list/heading level through command dispatch
- preserve front matter round-trip
- preserve footnotes round-trip
- preserve TOC token/block round-trip

---

## Success Criteria

This initiative succeeds when:

- the editor no longer exposes obvious missing basics in normal writing sessions
- users can insert and manipulate common writing structures from the UI
- the app supports the baseline Markdown primitives expected in technical writing workflows
- the next most visible missing features shift from "missing fundamentals" to "quality-of-life improvements"
