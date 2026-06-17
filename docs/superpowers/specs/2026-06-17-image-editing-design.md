# Image Editing — Design Spec

**Reference:** Typora image features
**Goal:** Add full image editing capabilities: right-click context menu, resize handles, alignment, and selection toolbar.

---

## Architecture

Hybrid approach extending existing patterns:
- **Enhanced NodeView** for selection visuals + resize handles (DOM-based)
- **ProseMirror plugin** for floating image toolbar on selection
- **Vue context menu** for image-specific right-click items (reuses existing `ContextMenu.vue`)

---

## 1. Schema Changes — `src/editor/schema.ts`

Add three optional attributes to the `image` node:

```
attrs: {
  src: {},
  alt: { default: null },
  title: { default: null },
  displaySrc: { default: null },
  width: { default: null },    // natural px
  height: { default: null },   // natural px
  align: { default: "inline" }, // "inline" | "left" | "center" | "right"
}
```

---

## 2. Markdown Round-trip

**Serialization** (`markdown-serializer.ts` line 37-39):
- Build title string: `"{W}x{H} align={align}"` when width/height/align present
- Otherwise leave title as-is

**Parsing** (`inline-parser.ts` lines 54-63):
- Parse title for `"{W}x{H}"` pattern and `"align=left|center|right"` keyword
- Extract and populate `width`, `height`, `align` attrs

**Compatibility:** Standard Markdown readers see `![alt](src "1200x800 align=center")` as a normal image with a tooltip title — no breakage.

---

## 3. Enhanced Image NodeView — `src/editor/image-node-view.ts`

Replace the minimal `<img>` NodeView:

**DOM structure:**
```html
<div class="md-image-container md-image--align-{align} md-image--selected">
  <div class="md-image-wrapper">
    <img src="..." alt="..." />
    <!-- 8 resize handles inserted outside <img> -->
    <div class="md-image-handle md-image-handle--nw"></div>
    <div class="md-image-handle md-image-handle--n"></div>
    ... (n, ne, e, se, s, sw, w)
  </div>
</div>
```

**Behavior:**
- Click on image → set `selected` state (blue outline, handles visible)
- Click outside → clear selection (via document click listener)
- Drag corner handle → maintain aspect ratio, scale proportionally
- Drag edge handle → adjust only that dimension
- On drag end → dispatch `view.dispatch(tr.setNodeMarkup(pos, null, newAttrs))` updating `width`/`height`
- `width: null` means "display at natural size" (no explicit width set)
- Alignment changes applied via CSS classes on the container

**CSS classes:**
- `md-image--align-inline` — inline in text flow
- `md-image--align-left` — `float: left; margin-right: 1em;`
- `md-image--align-center` — `display: block; margin: 0 auto;`
- `md-image--align-right` — `float: right; margin-left: 1em;`

---

## 4. Image Toolbar Plugin — `src/editor/image-toolbar-plugin.ts`

ProseMirror `Plugin` that tracks selected image position and provides a floating toolbar.

**Toolbar items:**
| Action | Description |
|--------|-------------|
| Reset size | Sets `width`/`height` to `null` (natural size) |
| Size display | Read-only label: `"1200 × 800"` |
| Align: Inline | Sets `align = "inline"` |
| Align: Left | Sets `align = "left"` |
| Align: Center | Sets `align = "center"` |
| Align: Right | Sets `align = "right"` |

**Positioning:**
- Uses `view.coordsAtPos(imagePos)` to compute the image's bounding rect
- Toolbar floats above the image, horizontally centered
- Repositions on scroll/resize via `requestAnimationFrame` loop

**State:**
Plugin state tracks `{ pos: number | null }` (the position of the selected image node). Toolbar is visible when `pos !== null`.

**Integration:**
- Registered in `createEditorPlugins()` in `src/editor/plugins.ts`
- Communicates with NodeView selection state via a shared event or plugin key

---

## 5. Context Menu Changes — `src/editor/EditorView.vue`

### Right-click detection (lines 219-236)

Add image detection in `openContextMenu`:
```ts
// Check if right-clicked on an image inside the editor
const imgEl = target?.closest?.('.md-image-container img, .ProseMirror img');
if (imgEl) {
  // Find the image node position in ProseMirror
  rightClickedImage.value = findImageAtClick(view, event);
} else {
  rightClickedImage.value = null;
}
```

### Menu items (computed `menuItems`)

When `rightClickedImage.value !== null`, prepend image items:
```ts
[
  { type: "action", id: "image.copyImage", label: t("menu.image.copyImage") },
  { type: "action", id: "image.copyPath", label: t("menu.image.copyPath") },
  { type: "action", id: "image.saveAs", label: t("menu.image.saveAs") },
  { type: "action", id: "image.revealInFinder", label: t("menu.image.revealInFinder") },
  { type: "separator", id: "sep-image" },
  // ... existing items
]
```

---

## 6. Image Commands — `src/lib/image-commands.ts`

| Command ID | Implementation |
|------------|---------------|
| `image.copyImage` | Resolve image file path from node → read bytes → `navigator.clipboard.write([new ClipboardItem({"image/png": blob})])` |
| `image.copyPath` | `navigator.clipboard.writeText("![alt](src)")` from node attrs |
| `image.saveAs` | Open native save dialog → copy image bytes to chosen path (Tauri dialog + fs write) |
| `image.revealInFinder` | Resolve absolute path → invoke Tauri `reveal_in_finder` |
| `image.resetSize` | `tr.setNodeMarkup(pos, null, { ...attrs, width: null, height: null })` |
| `image.setAlign` | `tr.setNodeMarkup(pos, null, { ...attrs, align: value })` |

`revealImageInFinder` needs the absolute path — which can be reconstructed from doc path + relative `src`. Add a helper in `image-assets.ts`.

---

## 7. I18n

New keys:
```ts
// en.ts
"menu.image.copyImage": "Copy Image",
"menu.image.copyPath": "Copy Image Path",
"menu.image.saveAs": "Save Image As...",
"menu.image.revealInFinder": "Reveal in Finder",
"menu.image.resetSize": "Reset Size",
"menu.image.alignInline": "Inline",
"menu.image.alignLeft": "Align Left",
"menu.image.alignCenter": "Align Center",
"menu.image.alignRight": "Align Right",

// zh-CN.ts
"menu.image.copyImage": "复制图片",
"menu.image.copyPath": "复制图片路径",
"menu.image.saveAs": "另存为...",
"menu.image.revealInFinder": "在访达中显示",
"menu.image.resetSize": "重置尺寸",
"menu.image.alignInline": "内联",
"menu.image.alignLeft": "左对齐",
"menu.image.alignCenter": "居中",
"menu.image.alignRight": "右对齐",
```

---

## 8. File Changes Summary

| File | Action |
|------|--------|
| `src/editor/schema.ts` | Add `width`, `height`, `align` attrs to image node |
| `src/editor/image-node-view.ts` | **Rewrite** — container DOM with resize handles, selection state, alignment classes |
| `src/editor/image-toolbar-plugin.ts` | **New** — floating toolbar plugin |
| `src/lib/image-commands.ts` | **New** — command implementations for all image actions |
| `src/editor/EditorView.vue` | Add image detection in right-click handler, dynamic menu items |
| `src/editor/plugins.ts` | Register image toolbar plugin |
| `src/editor/markdown-serializer.ts` | Serialize width/height/align into title |
| `src/editor/inline-parser.ts` | Parse width/height/align from title |
| `src/lib/image-assets.ts` | Add `resolveImageAbsolutePath`, helper functions |
| `src/i18n/locales/en.ts` | New image menu labels |
| `src/i18n/locales/zh-CN.ts` | New image menu labels |
| `tests/unit/image-node-view.spec.ts` | **New** — resize handles, selection, alignment |
| `tests/unit/image-toolbar.spec.ts` | **New** — toolbar commands and positioning |
| `tests/unit/image-commands.spec.ts` | **New** — copy, save, reveal commands |
| `tests/unit/image-context-menu.spec.ts` | **New** — right-click detection, menu injection |
| `tests/unit/image-markdown-roundtrip.spec.ts` | **New** — width/height/align serialization round-trip |

---

## Self-Review

- **Placeholder scan:** No TBD/TODO markers
- **Internal consistency:** `width`/`height`/`align` attrs used consistently across schema, NodeView, serialization, toolbar
- **Scope:** Single focused feature — image editing. No unrelated changes.
- **Ambiguity:** Width/height semantics clear (CSS px, null = natural size); alignment values enumerated; title format specified with exact pattern
