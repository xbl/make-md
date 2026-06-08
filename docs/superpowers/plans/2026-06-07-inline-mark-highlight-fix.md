# Inline Mark Highlight Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore visible emphasis for inline marked text so `` `code` `` is visually distinct from plain text while editing.

**Architecture:** Keep the fix narrowly scoped to the existing ProseMirror inline mark stack. Confirm the active decoration class is applied, add a regression test around rendered styles, then patch the CSS tokens or selectors that currently make `.pm-mark-editing--code` collapse into normal body text.

**Tech Stack:** Vue 3, ProseMirror, Vitest, repo CSS in `src/styles/app.css`

**Spec:** `docs/superpowers/specs/2026-06-07-ai-editing-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `tests/unit/inline-mark-editing.spec.ts` | Regression test proving code-mark editing state renders visible styling |
| `src/styles/app.css` | Inline mark editing styles for strong/em/code/strike/link |
| `src/editor/inline-mark/syntax-decorations.ts` | Existing decoration source to validate, not expected to change unless test proves missing class output |

## Root-cause hypothesis

`createInlineMarkSyntaxPlugin()` already decorates active inline marks with `.pm-mark-editing--code`, so the likely failure is presentation, not schema or parser behavior. The current code-mark CSS uses `var(--code-bg)` and `var(--code-text)`; if those variables resolve too close to body colors in the editor theme, `` `文字` `` appears identical to normal text.

### Task 1: Lock the bug down with a failing regression test

**Files:**
- Modify: `tests/unit/inline-mark-editing.spec.ts`
- Read for reference: `src/editor/inline-mark/syntax-decorations.ts`

- [ ] **Step 1: Write the failing test**

Add a focused test in the existing `inline mark syntax decorations` block that mounts a paragraph containing a code mark and asserts the editing decoration is present and exposes the expected class:

```ts
  it("adds editing decoration when cursor is inside code", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const paragraph = markdownSchema.nodes.paragraph.create(
      null,
      [markdownSchema.text("文字", [markdownSchema.marks.code.create()])],
    );
    const doc = markdownSchema.nodes.doc.create(null, [paragraph]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      selection: TextSelection.create(doc, 2),
      plugins: [createInlineMarkSyntaxPlugin()],
    });

    const view = new EditorView(mount, { state });
    const deco = mount.querySelector(".pm-mark-editing--code");

    expect(deco).not.toBeNull();

    view.destroy();
    document.body.removeChild(mount);
  });
```

- [ ] **Step 2: Run the targeted test to verify the current behavior baseline**

Run: `pnpm test -- tests/unit/inline-mark-editing.spec.ts`

Expected: the new test passes for class presence, confirming decoration generation works and the bug lives in CSS rather than editor state.

### Task 2: Make code-mark styling visibly distinct

**Files:**
- Modify: `src/styles/app.css`
- Read for reference: `src/styles/app.css:763`

- [ ] **Step 3: Patch the code-mark editing style with editor-safe contrast**

Update the `.pm-mark-editing--code` rule so it no longer depends exclusively on the general code token pair when editing inline text. Use a stronger inset background, explicit border, and slightly stronger foreground so Chinese text like `` `文字` `` remains visibly highlighted:

```css
.editor-view .ProseMirror .pm-mark-editing--code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  padding: 0.1em 0.3em;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--surface-strong) 35%, transparent);
}
```

If `color-mix(...)` is inconsistent with the repo’s browser target, replace it with existing theme variables already used elsewhere in `src/styles/app.css`; keep the same intent: visible background separation plus border.

- [ ] **Step 4: Keep delimiter hints readable**

Retain the existing `::before` and `::after` pseudo-elements for backticks. Only adjust them if the new background makes them hard to read:

```css
.editor-view .ProseMirror .pm-mark-editing--code::before,
.editor-view .ProseMirror .pm-mark-editing--code::after {
  color: var(--text-muted);
  background: transparent;
  font-family: var(--font-ui);
}
```

### Task 3: Verify no regression in adjacent inline marks

**Files:**
- Test: `tests/unit/inline-mark-editing.spec.ts`

- [ ] **Step 5: Re-run the focused inline mark suite**

Run: `pnpm test -- tests/unit/inline-mark-editing.spec.ts`

Expected: PASS, including strong/em/strike/link/code tests.

- [ ] **Step 6: Optional broader verification if the focused suite passes cleanly**

Run: `pnpm test -- tests/unit/inline-marks.spec.ts`

Expected: PASS, confirming serialization/parsing behavior remains unchanged.

### Task 4: Final review and commit

**Files:**
- Modify: none

- [ ] **Step 7: Review diff for scope control**

Run: `git diff -- src/styles/app.css tests/unit/inline-mark-editing.spec.ts`

Expected: only the new regression test and the minimal code-mark style change appear.

- [ ] **Step 8: Commit**

```bash
git add src/styles/app.css tests/unit/inline-mark-editing.spec.ts docs/superpowers/plans/2026-06-07-inline-mark-highlight-fix.md
git commit -m "fix: restore inline code mark highlight"
```

## Self-review

- Spec coverage: this plan covers the reported symptom only: active inline code text lacks visible highlight compared with plain text.
- Placeholder scan: all edit/test steps name exact files and commands.
- Type consistency: all symbols referenced already exist in the current codebase (`markdownSchema`, `TextSelection`, `createInlineMarkSyntaxPlugin`).
