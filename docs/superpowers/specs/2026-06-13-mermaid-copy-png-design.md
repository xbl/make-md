# Mermaid Copy Diagram as PNG Design

**Date:** 2026-06-13  
**Status:** Approved  
**Goal:** Add right-click context menu copy support for Mermaid diagram previews in the editor, exporting them as PNG to the clipboard for easy pasting with Cmd+V.

---

## Problem

Mermaid diagram previews in the Markdown editor are rendered as SVG elements inside widget decorations. While this looks sharp in the editor, users often need to copy these diagrams to use them in external documents or communication tools (such as Word, Slack, Teams, or WeChat). 

Currently, there is no way to copy a Mermaid diagram from the editor. Copying it as a PNG with a standard background is needed to make pasting (Cmd+V) seamless.

---

## Approach

Use the shared frontend `ContextMenu` in `EditorView.vue` to dynamically add a copy action when a user right-clicks on a successful Mermaid preview.

1. **Context Interception:** In `EditorView.vue`'s `openContextMenu` event, check if the click target is within a ready Mermaid diagram (`.mermaid-preview--ready`). If so, retrieve the SVG outer HTML and store it.
2. **Dynamic Menu Items:** If a Mermaid SVG is captured on right-click, dynamically prepend a "Copy Diagram as PNG" menu option to the editor context menu.
3. **SVG-to-PNG Conversion:** Implement a helper function `convertSvgToPngBlob(svgHtml)` in `src/lib/image-helpers.ts` which loads the SVG data URL into an `Image`, draws it onto a canvas filled with a solid white background, and encodes it to a PNG Blob.
4. **Clipboard Copy:** Write the resulting PNG blob to the clipboard using the modern `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])` web API.

---

## Architecture & Integration

### Internationalization

Add the localized menu option label to `en` and `zh-CN` locales:
- `src/i18n/locales/en.ts`
- `src/i18n/locales/zh-CN.ts`

Key: `"editor.menu.copyMermaidPng"`

### Context Menu Flow in `EditorView.vue`

```text
Right Click -> event.target inside .mermaid-preview--ready?
                 |
                 +--> Yes: Extract SVG HTML -> Set rightClickedSvg ref -> Prepend "Copy Diagram as PNG" item
                 |
                 +--> No: Set rightClickedSvg to null -> Show standard editor context menu
```

### SVG rendering on Canvas

Since SVG elements rendered by Mermaid include their styles inside `<style>` blocks, serializing `svgEl.outerHTML` fully preserves custom styling and colors.
To guarantee compatibility with dark and light themes in pasting destinations, we fill the Canvas context with `#ffffff` (solid white background) before drawing the image.

---

## Error Handling

- If the canvas context cannot be initialized or SVG fails to load inside the hidden `Image` element, throw a clear error, catch it in the menu select handler, and show a user-friendly alert (`window.alert`).
- Clean up Object URLs immediately using `try ... finally` with `URL.revokeObjectURL(url)`.

---

## Testing

### Unit Testing
- Test the new image helper `convertSvgToPngBlob` or standard validation flows with mock SVGs in a new test file: `tests/unit/image-helpers.spec.ts`.

### Manual Testing
- Write a Mermaid block in the editor (e.g., `graph TD\n A --> B`).
- Wait for it to render.
- Right-click on the rendered diagram.
- Verify that "Copy Diagram as PNG" / "复制图表为 PNG" appears in the context menu.
- Click it.
- Verify you can paste the diagram into external image-supporting applications (e.g., Pages, Word, Finder, or image viewers).

---

## Success Criteria

- Right-clicking on a Mermaid preview shows the "Copy Diagram as PNG" (or localized "复制图表为 PNG") option at the top of the context menu.
- Clicking the option converts the SVG to a PNG with a white background.
- The PNG is successfully copied to the clipboard.
- The user can paste the copied PNG into any image-supporting application using `Cmd+V`.
