# Toolbar Styleguide — Design Spec

**Date:** 2026-06-18
**Goal:** Unify the AI Edit toolbar and Image toolbar into a single visual system with mutual exclusion — when an image node is selected, only the image toolbar appears; when text is selected, only the AI toolbar appears.

---

## Architecture

Two independent changes:

- **Mutual exclusion** via a ProseMirror `NodeSelection` guard in `updateSelectionToolbar()`. The AI toolbar only appears for `TextSelection`; `NodeSelection` (images, horizontal rules, etc.) is rejected.
- **Visual unification** via a shared `.editor-toolbar` base class with theme-aware CSS custom properties. Both the Vue `AiEditToolbar.vue` and the imperative `image-toolbar-plugin.ts` use the same BEM classes.

---

## 1. Mutual Exclusion Rule

**File:** `src/editor/EditorView.vue`

When `updateSelectionToolbar()` runs on every transaction dispatch, it now checks:
```ts
if (selection.empty || selection instanceof NodeSelection) {
  hideSelectionToolbar();
  return;
}
```

- `selection.empty` — cursor (zero-width) or no selection → no toolbar
- `selection instanceof NodeSelection` — a structural node (image, hr, widget) is selected → no AI toolbar
- Only `TextSelection` passes both checks → AI toolbar visible

ProseMirror creates a `NodeSelection` when clicking on an inline image node. This guard ensures the image toolbar (which responds to DOM click events) and the AI toolbar (which responds to ProseMirror selection) are mutually exclusive.

---

## 2. CSS Custom Properties

**File:** `src/styles/app.css`

Toolbar-specific variables added to `:root` and `:root[data-theme="dark"]`:

| Variable | Light | Dark |
|---|---|---|
| `--toolbar-bg` | `color-mix(in srgb, var(--bg-elevated) 94%, transparent)` | `color-mix(in srgb, var(--bg-elevated) 94%, transparent)` |
| `--toolbar-bg-hover` | `rgba(28, 28, 26, 0.06)` | `rgba(255, 255, 255, 0.08)` |
| `--toolbar-text` | `var(--text-secondary)` | `var(--text-secondary)` |
| `--toolbar-text-hover` | `var(--text-primary)` | `var(--text-primary)` |
| `--toolbar-border` | `var(--border)` | `var(--border)` |
| `--toolbar-shadow` | `0 4px 16px rgba(28, 28, 26, 0.10)` | `0 4px 16px rgba(0, 0, 0, 0.30)` |

The background inherits `--bg-elevated` — white (`#ffffff`) in light, dark gray (`#2a2a28`) in dark — so the toolbar is always theme-aware with no hardcoded colors.

---

## 3. Unified Class System

### BEM Naming

| Class | Element | Used by |
|---|---|---|
| `.editor-toolbar` | Container (base) | Both toolbars |
| `.editor-toolbar__btn` | Action button | Both toolbars |
| `.editor-toolbar__size` | Read-only size label | Image toolbar only |

### Visual Spec

| Property | Value |
|---|---|
| `border-radius` | `6px` |
| `padding` | `6px 8px` |
| `gap` | `4px` |
| `font-size` (button) | `12px` |
| `font-size` (label) | `11px` |
| `z-index` | `30` |
| `backdrop-filter` | `blur(10px)` |
| Horizontal centering | `transform: translateX(-50%)` |

### CSS Block

```css
.editor-toolbar {
  position: absolute;
  z-index: 30;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--toolbar-border);
  border-radius: 6px;
  background: var(--toolbar-bg);
  box-shadow: var(--toolbar-shadow);
  backdrop-filter: blur(10px);
  transform: translateX(-50%);
  pointer-events: auto;
}

.editor-toolbar__btn {
  border: 0;
  border-radius: 4px;
  padding: 4px 8px;
  background: transparent;
  color: var(--toolbar-text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.editor-toolbar__btn:hover {
  background: var(--toolbar-bg-hover);
  color: var(--toolbar-text-hover);
}

.editor-toolbar__size {
  font-size: 11px;
  color: var(--toolbar-text);
  opacity: 0.7;
  margin-right: 8px;
  white-space: nowrap;
}
```

---

## 4. Per-Component Usage

### AiEditToolbar.vue

Vue component, rendered in `EditorView.vue` template with `v-if="selectionToolbar.visible"`. Uses `:style` binding for positioning (left/top from `updateSelectionToolbar`).

```html
<div class="editor-toolbar" :style="toolbarStyle" data-testid="ai-edit-toolbar">
  <button ... class="editor-toolbar__btn">Polish</button>
  <button ... class="editor-toolbar__btn">Custom...</button>
</div>
```

### image-toolbar-plugin.ts

ProseMirror plugin, creates DOM imperatively. Appended to `editorView.dom.parentElement`. Positioned via `positionBar()` setting inline `left`/`top` styles.

DOM:
```
div.editor-toolbar
  span.editor-toolbar__size           "800 × 600"
  button.editor-toolbar__btn[data-align="inline"]   "Inline"
  button.editor-toolbar__btn[data-align="left"]     "Left"
  button.editor-toolbar__btn[data-align="center"]   "Center"
  button.editor-toolbar__btn[data-align="right"]    "Right"
  button.editor-toolbar__btn                        "Reset Size"
```

The reset button is the only `.editor-toolbar__btn` without `[data-align]`, queried via:
```ts
bar.querySelector(".editor-toolbar__btn:not([data-align])")
```

---

## 5. Z-Index Layering

| Layer | z-index | Element |
|---|---|---|
| Table controls overlay | (existing) | `.table-controls-overlay` |
| **Editor toolbars** | **30** | `.editor-toolbar` |
| AI edit toolbar (old) | 20 | removed |
| Image toolbar (old) | 100 | removed |
| Context menu | (existing) | `.context-menu` |

---

## 6. File Changes Summary

| File | Action |
|---|---|
| `src/editor/EditorView.vue` | Import `NodeSelection`, add guard in `updateSelectionToolbar()` |
| `src/styles/app.css` | Add 12 CSS vars (`:root` + dark), replace 2 old toolbar blocks with 1 unified block |
| `src/components/AiEditToolbar.vue` | Rename 2 CSS classes in template |
| `src/editor/image-toolbar-plugin.ts` | Rename 6 class references, fix `positionBar` centering, fix click target, fix reset button selector |
