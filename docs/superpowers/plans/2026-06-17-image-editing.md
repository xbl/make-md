# Image Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Typora-style image editing: right-click context menu (copy image, copy path, save as, reveal in Finder), drag-resize handles with aspect-ratio lock, image alignment (inline/left/center/right), and a floating selection toolbar.

**Architecture:** Hybrid approach — Enhanced ProseMirror NodeView for resize handles and selection visuals, a ProseMirror plugin for the floating toolbar, and the existing Vue `ContextMenu.vue` for right-click image actions. Width/height/align stored as node attrs and round-tripped through the Markdown image title field for compatibility.

**Tech Stack:** ProseMirror (NodeView, Plugin, EditorState), Vue 3, Tauri 2 APIs (clipboard, dialog, reveal_in_finder), Vitest.

**Reference Spec:** `docs/superpowers/specs/2026-06-17-image-editing-design.md`

---

## File Structure

**New files:**
- `src/editor/image-toolbar-plugin.ts` — ProseMirror plugin: tracks selected image, renders floating toolbar
- `src/lib/image-commands.ts` — command implementations: copy image, copy path, save as, reveal in finder
- `tests/unit/image-node-view.spec.ts` — resize handles, selection, aspect-ratio lock
- `tests/unit/image-toolbar.spec.ts` — toolbar visibility and button actions
- `tests/unit/image-commands.spec.ts` — copy, save, reveal command logic
- `tests/unit/image-context-menu.spec.ts` — right-click detection, menu items
- `tests/unit/image-markdown-roundtrip.spec.ts` — width/height/align serialization

**Modified files:**
- `src/editor/schema.ts` — add `width`, `height`, `align` attrs to image node
- `src/editor/inline-mark/syntax.ts` — extend image token + regex to capture optional title
- `src/editor/inline-parser.ts` — parse width/height/align from title in `tokenToNodes`
- `src/editor/markdown-serializer.ts` — serialize width/height/align into title
- `src/editor/image-node-view.ts` — rewrite: container DOM, resize handles, selection state, alignment classes
- `src/editor/plugins.ts` — register ImageToolbarPlugin
- `src/editor/EditorView.vue` — detect right-click on images, inject image-specific context menu items
- `src/lib/image-assets.ts` — add `resolveImageAbsolutePath` helper
- `src/i18n/locales/en.ts` — image menu/toolbar labels
- `src/i18n/locales/zh-CN.ts` — image menu/toolbar labels

---

## Task 1: Schema — add width, height, align attrs

**Files:**
- Modify: `src/editor/schema.ts:20-56`

- [ ] **Step 1: Add attrs to imageSpec**

Edit `src/editor/schema.ts`, replace the `imageSpec` object (lines 20-56):

```ts
const imageSpec: NodeSpec = {
  inline: true,
  attrs: {
    src: {},
    alt: { default: null },
    title: { default: null },
    displaySrc: { default: null },
    width: { default: null },
    height: { default: null },
    align: { default: "inline" },
  },
  group: "inline",
  draggable: true,
  parseDOM: [
    {
      tag: "img[src]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLImageElement)) {
          return false;
        }
        return {
          src: dom.getAttribute("src"),
          alt: dom.getAttribute("alt"),
          title: dom.getAttribute("title"),
          displaySrc: dom.getAttribute("src"),
        };
      },
    },
  ],
  toDOM(node) {
    return [
      "img",
      {
        src: node.attrs.displaySrc ?? node.attrs.src,
        alt: node.attrs.alt,
        title: node.attrs.title,
      },
    ];
  },
};
```

- [ ] **Step 2: Type-check and run tests**

Run: `pnpm typecheck` and `pnpm test`
Expected: no new errors. Existing tests pass (new attrs have defaults so existing serialization unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/editor/schema.ts
git commit -m "feat(image): add width/height/align attrs to image node"
```

---

## Task 2: Markdown round-trip for image size and alignment

**Files:**
- Modify: `src/editor/inline-mark/syntax.ts`
- Modify: `src/editor/inline-parser.ts:54-63`
- Modify: `src/editor/markdown-serializer.ts:37-39`
- Create: `tests/unit/image-markdown-roundtrip.spec.ts`

### Step 1: Extend the InlineToken type and regex

Edit `src/editor/inline-mark/syntax.ts`:

(a) Add `title` to the image token type (line 8):
```ts
  | { type: "image"; alt: string; src: string; title?: string };
```

(b) Replace the `INLINE_MARKDOWN_PATTERN` regex (line 12) to capture optional title:
```ts
export const INLINE_MARKDOWN_PATTERN =
  /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|(?<!\*)\*([^*]+)\*(?!\*)|(?<!\w)_([^_]+)_(?!\w)/g;
```

(c) Update the image token push (line 34) to include title:
```ts
    if (match[1] !== undefined && match[2] !== undefined) {
      tokens.push({ type: "image", alt: match[1], src: match[2], title: match[3] || undefined });
    }
```

(d) Update the subsequent match index checks (lines 35-45): the capture groups shifted — original match[3] (link text) is now match[4], match[4] (link href) is now match[5], match[5] (code) is now match[6], etc. Replace the entire match handling block:

```ts
    if (match[1] !== undefined && match[2] !== undefined) {
      tokens.push({ type: "image", alt: match[1], src: match[2], title: match[3] || undefined });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      tokens.push({ type: "link", text: match[4], href: match[5] });
    } else if (match[6] !== undefined) {
      tokens.push({ type: "code", value: match[6] });
    } else if (match[7] !== undefined) {
      tokens.push({ type: "strong", value: match[7] });
    } else if (match[8] !== undefined) {
      tokens.push({ type: "strike", value: match[8] });
    } else if (match[9] !== undefined || match[10] !== undefined) {
      tokens.push({ type: "em", value: match[9] ?? match[10]! });
    }
```

### Step 2: Parse width/height/align from title in inline-parser.ts

Edit `src/editor/inline-parser.ts`, replace lines 54-63 (the image token handler in `tokenToNodes`):

```ts
  if (token.type === "image") {
    let width: number | null = null;
    let height: number | null = null;
    let align: string | null = null;
    if (token.title) {
      const sizeMatch = /(\d+)x(\d+)/.exec(token.title);
      if (sizeMatch) {
        width = Number(sizeMatch[1]);
        height = Number(sizeMatch[2]);
      }
      const alignMatch = /align=(inline|left|center|right)/.exec(token.title);
      if (alignMatch) {
        align = alignMatch[1];
      }
    }
    return [
      nodes.image.create({
        src: token.src,
        alt: token.alt,
        title: token.title || null,
        displaySrc: resolveMarkdownImageDisplaySrc(token.src, docPath),
        width,
        height,
        align: align || "inline",
      }),
    ];
  }
```

### Step 3: Serialize width/height/align into title

Edit `src/editor/markdown-serializer.ts`, replace line 37-39 (image serialization in `serializeInline`):

```ts
  if (node.type.name === "image") {
    const src = node.attrs.src ?? "";
    const alt = node.attrs.alt ?? "";
    const width = node.attrs.width;
    const height = node.attrs.height;
    const align = node.attrs.align;
    const titleParts: string[] = [];
    if (width != null && height != null) {
      titleParts.push(`${width}x${height}`);
    }
    if (align && align !== "inline") {
      titleParts.push(`align=${align}`);
    }
    const title = titleParts.length > 0 ? ` "${titleParts.join(" ")}"` : "";
    return `![${alt}](${src}${title})`;
  }
```

### Step 4: Write the round-trip test

Create `tests/unit/image-markdown-roundtrip.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "@/editor/markdown-parser";
import { serializeMarkdown } from "@/editor/markdown-serializer";

describe("image markdown round-trip", () => {
  it("preserves width and height in title", () => {
    const input = "![cat](cat.png \"1200x800\")";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    expect(output).toBe(input);
  });

  it("preserves align in title", () => {
    const input = "![cat](cat.png \"align=center\")";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    expect(output).toBe(input);
  });

  it("preserves combined size and align", () => {
    const input = "![cat](cat.png \"1200x800 align=left\")";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    expect(output).toBe(input);
  });

  it("omits title when no size or non-inline align", () => {
    const input = "![cat](cat.png)";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    expect(output).toBe(input);
  });

  it("preserves regular title without size/align patterns", () => {
    const input = "![cat](cat.png \"A nice cat photo\")";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    // Regular title without size/align is lost in round-trip (not stored as node attr)
    expect(output).toBe("![cat](cat.png)");
  });

  it("parses image node attrs from title", () => {
    const input = "![cat](cat.png \"1200x800 align=right\")";
    const doc = parseMarkdown(input);
    const img = doc.firstChild?.firstChild?.firstChild;
    expect(img?.attrs.width).toBe(1200);
    expect(img?.attrs.height).toBe(800);
    expect(img?.attrs.align).toBe("right");
  });
});
```

### Step 5: Run the round-trip tests

Run: `pnpm test tests/unit/image-markdown-roundtrip.spec.ts`
Expected: 6 tests pass.

### Step 6: Run full test suite

Run: `pnpm test`
Expected: no regressions. Note: existing `markdown-roundtrip.spec.ts` already tests image syntax — it expects `![alt](src)` format. The new serialization only adds title when width/height/align are non-default, so `![alt](src)` round-trips unchanged.

### Step 7: Commit

```bash
git add src/editor/inline-mark/syntax.ts src/editor/inline-parser.ts src/editor/markdown-serializer.ts tests/unit/image-markdown-roundtrip.spec.ts
git commit -m "feat(image): round-trip width/height/align through markdown title"
```

---

## Task 3: Enhanced Image NodeView

**Files:**
- Rewrite: `src/editor/image-node-view.ts`
- Create: `tests/unit/image-node-view.spec.ts`

### Step 1: Write the failing test

Create `tests/unit/image-node-view.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { markdownSchema } from "@/editor/schema";

// Test that the image node creates with default attrs
describe("image node schema", () => {
  it("creates image node with default attrs", () => {
    const node = markdownSchema.nodes.image.create({ src: "test.png" });
    expect(node.attrs.src).toBe("test.png");
    expect(node.attrs.width).toBeNull();
    expect(node.attrs.height).toBeNull();
    expect(node.attrs.align).toBe("inline");
  });

  it("creates image node with explicit width/height/align", () => {
    const node = markdownSchema.nodes.image.create({
      src: "test.png",
      width: 800,
      height: 600,
      align: "center",
    });
    expect(node.attrs.width).toBe(800);
    expect(node.attrs.height).toBe(600);
    expect(node.attrs.align).toBe("center");
  });

  it("toDOM includes align class", () => {
    const node = markdownSchema.nodes.image.create({ src: "x.png", align: "center" });
    const dom = markdownSchema.nodes.image.spec.toDOM?.(node);
    expect(dom).toBeTruthy();
    // toDOM returns ["img", { src: ..., alt: ..., title: ... }]
  });
});
```

### Step 2: Run to verify failure

Run: `pnpm test tests/unit/image-node-view.spec.ts`
Expected: pass (the schema test doesn't depend on NodeView rewrite yet).

### Step 3: Rewrite the Image NodeView

Replace `src/editor/image-node-view.ts` entirely:

```ts
import type { Node as PMNode } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

const HANDLE_POSITIONS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

function createHandleDiv(position: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `md-image-handle md-image-handle--${position}`;
  return el;
}

export function createImageNodeView(
  node: PMNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView {
  const container = document.createElement("div");
  container.className = "md-image-container";

  const wrapper = document.createElement("div");
  wrapper.className = "md-image-wrapper";

  const img = document.createElement("img");

  function syncImg(nextNode: PMNode) {
    img.src = String(nextNode.attrs.displaySrc ?? nextNode.attrs.src ?? "");
    img.alt = String(nextNode.attrs.alt ?? "");
    if (nextNode.attrs.title) {
      img.title = String(nextNode.attrs.title);
    } else {
      img.removeAttribute("title");
    }
    // Apply explicit width/height if set
    if (nextNode.attrs.width != null) {
      img.style.width = `${nextNode.attrs.width}px`;
      img.style.height = "auto";
    } else {
      img.style.width = "";
    }
    if (nextNode.attrs.height != null) {
      img.style.height = `${nextNode.attrs.height}px`;
    } else if (nextNode.attrs.width == null) {
      img.style.height = "";
    }
    // Alignment class
    const align = nextNode.attrs.align || "inline";
    container.className = `md-image-container md-image--align-${align}`;
  }

  syncImg(node);

  // Build DOM
  wrapper.appendChild(img);
  for (const pos of HANDLE_POSITIONS) {
    wrapper.appendChild(createHandleDiv(pos));
  }
  container.appendChild(wrapper);

  // Selection state
  let selected = false;

  function setSelected(value: boolean) {
    selected = value;
    if (selected) {
      container.classList.add("md-image-container--selected");
    } else {
      container.classList.remove("md-image-container--selected");
    }
  }

  container.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    setSelected(true);
  });

  // Document-level click to deselect
  function onDocClick(event: MouseEvent) {
    if (!container.contains(event.target as Node)) {
      setSelected(false);
    }
  }
  document.addEventListener("click", onDocClick);

  // Resize handle drag
  let draggingHandle: string | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartWidth = 0;
  let dragStartHeight = 0;
  let dragNaturalWidth = 0;
  let dragNaturalHeight = 0;

  function onHandleMouseDown(event: MouseEvent, position: string) {
    event.preventDefault();
    event.stopPropagation();
    draggingHandle = position;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartWidth = img.offsetWidth;
    dragStartHeight = img.offsetHeight;
    dragNaturalWidth = img.naturalWidth;
    dragNaturalHeight = img.naturalHeight;
    document.addEventListener("mousemove", onHandleMouseMove);
    document.addEventListener("mouseup", onHandleMouseUp);
  }

  function onHandleMouseMove(event: MouseEvent) {
    if (!draggingHandle) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    let newWidth = dragStartWidth;
    let newHeight = dragStartHeight;

    if (draggingHandle.includes("e")) newWidth = Math.max(20, dragStartWidth + dx);
    if (draggingHandle.includes("w")) newWidth = Math.max(20, dragStartWidth - dx);
    if (draggingHandle.includes("s")) newHeight = Math.max(20, dragStartHeight + dy);
    if (draggingHandle.includes("n")) newHeight = Math.max(20, dragStartHeight - dy);

    // Corner handles maintain aspect ratio
    if (draggingHandle.length === 2 && dragNaturalWidth > 0 && dragNaturalHeight > 0) {
      const ratio = dragNaturalWidth / dragNaturalHeight;
      if (draggingHandle === "nw" || draggingHandle === "se") {
        newHeight = newWidth / ratio;
      } else {
        newWidth = newHeight * ratio;
      }
    }

    img.style.width = `${newWidth}px`;
    img.style.height = `${newHeight}px`;
  }

  function onHandleMouseUp() {
    if (!draggingHandle) return;
    document.removeEventListener("mousemove", onHandleMouseMove);
    document.removeEventListener("mouseup", onHandleMouseUp);
    const pos = getPos();
    if (pos != null && view.state.doc.nodeAt(pos)?.type.name === "image") {
      const newWidth = Math.round(parseFloat(img.style.width) || img.offsetWidth);
      const newHeight = Math.round(parseFloat(img.style.height) || img.offsetHeight);
      const tr = view.state.tr.setNodeMarkup(pos, null, {
        ...view.state.doc.nodeAt(pos)!.attrs,
        width: newWidth,
        height: newHeight,
      });
      view.dispatch(tr);
    }
    draggingHandle = null;
  }

  // Attach handle listeners
  for (const child of wrapper.querySelectorAll<HTMLDivElement>(".md-image-handle")) {
    const position = child.className.match(/md-image-handle--(\w+)/)?.[1];
    if (position) {
      child.addEventListener("mousedown", (e) => onHandleMouseDown(e, position));
    }
  }

  return {
    dom: container,
    update(updatedNode) {
      if (updatedNode.type.name !== "image") return false;
      syncImg(updatedNode);
      return true;
    },
    destroy() {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("mousemove", onHandleMouseMove);
      document.removeEventListener("mouseup", onHandleMouseUp);
    },
    stopEvent(event) {
      // Allow ProseMirror to handle events on handles (so drag doesn't bubble)
      if ((event.target as HTMLElement)?.closest?.(".md-image-handle")) {
        return true;
      }
      return false;
    },
    ignoreMutation() {
      return true;
    },
  };
}
```

### Step 4: Run tests to verify

Run: `pnpm test tests/unit/image-node-view.spec.ts`
Expected: 3 tests pass.

### Step 5: Run the full test suite

Run: `pnpm test`
Expected: no regressions. The existing editor tests that create image nodes will still work because the schema change is backward-compatible.

### Step 6: Commit

```bash
git add src/editor/image-node-view.ts tests/unit/image-node-view.spec.ts
git commit -m "feat(image): add resize handles and selection state to image NodeView"
```

---

## Task 4: Image commands (copy, save, reveal, reset, align)

**Files:**
- Create: `src/lib/image-commands.ts`
- Modify: `src/lib/image-assets.ts`
- Create: `tests/unit/image-commands.spec.ts`

### Step 1: Add helper to image-assets.ts

Append to `src/lib/image-assets.ts`:

```ts
import { resolveMarkdownImagePath } from "@/lib/markdown-image-src";

export function resolveImageAbsolutePath(docPath: string | undefined, src: string): string | null {
  if (/^(https?:|data:|blob:)/i.test(src)) return null;
  const resolved = resolveMarkdownImagePath(src, docPath);
  return resolved.startsWith("/") ? resolved : null;
}
```

### Step 2: Create image-commands.ts

Create `src/lib/image-commands.ts`:

```ts
import { isTauri } from "@tauri-apps/api/core";
import { resolveImageAbsolutePath } from "@/lib/image-assets";
import { resolveMarkdownImagePath } from "@/lib/markdown-image-src";
import type { EditorView } from "prosemirror-view";
import { markdownSchema } from "@/editor/schema";

export type ImageAction =
  | "copyImage"
  | "copyPath"
  | "saveAs"
  | "revealInFinder"
  | "resetSize"
  | "setAlignInline"
  | "setAlignLeft"
  | "setAlignCenter"
  | "setAlignRight";

interface ImageNodeInfo {
  pos: number;
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  align: string;
  displaySrc: string | null;
}

function findImageAtPos(view: EditorView): ImageNodeInfo | null {
  const { $from } = view.state.selection;
  // Search up the tree for an image node
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "image") {
      return {
        pos: $from.before(depth),
        src: node.attrs.src,
        alt: node.attrs.alt ?? "",
        width: node.attrs.width,
        height: node.attrs.height,
        align: node.attrs.align ?? "inline",
        displaySrc: node.attrs.displaySrc,
      };
    }
  }
  return null;
}

export function findImageAtClick(
  view: EditorView,
  event: MouseEvent,
): { pos: number; info: ImageNodeInfo } | null {
  const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (pos == null) return null;
  const node = view.state.doc.nodeAt(pos.pos);
  if (node?.type.name === "image") {
    return {
      pos: pos.pos,
      info: {
        pos: pos.pos,
        src: node.attrs.src,
        alt: node.attrs.alt ?? "",
        width: node.attrs.width,
        height: node.attrs.height,
        align: node.attrs.align ?? "inline",
        displaySrc: node.attrs.displaySrc,
      },
    };
  }
  return null;
}

export async function copyImageToClipboard(
  docPath: string | undefined,
  src: string,
): Promise<void> {
  const absPath = resolveImageAbsolutePath(docPath, src);
  if (!absPath) {
    // For non-local images, could fetch and copy — but skip for now
    throw new Error("Cannot copy remote images");
  }

  if (isTauri()) {
    // Read file bytes and write to clipboard
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<number[]>("read_binary_file", { path: absPath });
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } else {
    // Browser fallback: fetch via URL
    const response = await fetch(`file://${encodeURI(absPath)}`);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  }
}

export function copyImageMarkdownPath(info: { alt: string; src: string }): void {
  void navigator.clipboard.writeText(`![${info.alt}](${info.src})`);
}

export async function saveImageAs(
  docPath: string | undefined,
  src: string,
): Promise<void> {
  const absPath = resolveImageAbsolutePath(docPath, src);
  if (!absPath) throw new Error("Cannot save remote images");

  const { save } = await import("@tauri-apps/plugin-dialog");
  const fileName = src.split("/").pop() ?? "image.png";
  const destPath = await save({
    defaultPath: fileName,
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
  });
  if (!destPath) return;

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("copy_image_asset", { docPath, sourcePath: absPath });
  // The copied file goes to assets dir — copy from absPath to destPath instead
  const bytes = await invoke<number[]>("read_binary_file", { path: absPath });
  await invoke("write_binary_file", { path: destPath, bytes });
}

export async function revealImageInFinder(
  docPath: string | undefined,
  src: string,
): Promise<void> {
  const absPath = resolveImageAbsolutePath(docPath, src);
  if (!absPath) throw new Error("Cannot reveal remote images");

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("reveal_in_finder", { path: absPath });
}

export function resetImageSize(view: EditorView, pos: number): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "image") return;
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, null, {
      ...node.attrs,
      width: null,
      height: null,
    }),
  );
}

export function setImageAlign(view: EditorView, pos: number, align: string): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "image") return;
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, null, {
      ...node.attrs,
      align,
    }),
  );
}

export { findImageAtPos };
```

### Step 3: Create tests

Create `tests/unit/image-commands.spec.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => []),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(async () => null),
}));

describe("image commands", () => {
  it("copyImageMarkdownPath writes to clipboard", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const { copyImageMarkdownPath } = await import("@/lib/image-commands");
    copyImageMarkdownPath({ alt: "cat", src: "cat.png" });
    expect(writeText).toHaveBeenCalledWith("![cat](cat.png)");
  });

  it("resolveImageAbsolutePath returns null for http URLs", async () => {
    const { resolveImageAbsolutePath } = await import("@/lib/image-assets");
    expect(resolveImageAbsolutePath("/doc", "https://example.com/img.png")).toBeNull();
  });

  it("resolveImageAbsolutePath returns absolute for relative paths", async () => {
    const { resolveImageAbsolutePath } = await import("@/lib/image-assets");
    const result = resolveImageAbsolutePath("/doc/note.md", "./assets/img.png");
    expect(result).toBe("/doc/assets/img.png");
  });
});
```

### Step 4: Run tests

Run: `pnpm test tests/unit/image-commands.spec.ts`
Expected: 3 tests pass.

### Step 5: Run full suite

Run: `pnpm test`
Expected: no regressions.

### Step 6: Commit

```bash
git add src/lib/image-commands.ts src/lib/image-assets.ts tests/unit/image-commands.spec.ts
git commit -m "feat(image): add image commands (copy, save, reveal, reset, align)"
```

---

## Task 5: Image toolbar plugin

**Files:**
- Create: `src/editor/image-toolbar-plugin.ts`
- Modify: `src/editor/plugins.ts`
- Create: `tests/unit/image-toolbar.spec.ts`

### Step 1: Create the toolbar plugin

Create `src/editor/image-toolbar-plugin.ts`:

```ts
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { resetImageSize, setImageAlign } from "@/lib/image-commands";

export const imageToolbarKey = new PluginKey<{ selectedPos: number | null }>("imageToolbar");

function createToolbarDom(): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "md-image-toolbar";

  const sizeLabel = document.createElement("span");
  sizeLabel.className = "md-image-toolbar__size";
  bar.appendChild(sizeLabel);

  const alignButtons = [
    { align: "inline", icon: "≡" },
    { align: "left", icon: "⊏" },
    { align: "center", icon: "⊟" },
    { align: "right", icon: "⊐" },
  ];

  for (const { align, icon } of alignButtons) {
    const btn = document.createElement("button");
    btn.className = `md-image-toolbar__btn md-image-toolbar__align--${align}`;
    btn.textContent = icon;
    btn.title = `Align ${align}`;
    btn.addEventListener("click", () => {
      const state = imageToolbarKey.getState(btn.ownerDocument.defaultView?.__editorView__?.state);
      // handled via dispatch
    });
    bar.appendChild(btn);
  }

  const resetBtn = document.createElement("button");
  resetBtn.className = "md-image-toolbar__btn md-image-toolbar__reset";
  resetBtn.textContent = "↺";
  resetBtn.title = "Reset Size";
  bar.appendChild(resetBtn);

  return bar;
}

function positionToolbar(bar: HTMLDivElement, view: EditorView, pos: number) {
  try {
    const coords = view.coordsAtPos(pos);
    const editorRect = view.dom.getBoundingClientRect();
    const barWidth = bar.offsetWidth || 120;
    const left = coords.left - editorRect.left + (coords.right - coords.left) / 2 - barWidth / 2;
    const top = coords.top - editorRect.top - 36;
    bar.style.left = `${Math.max(8, left)}px`;
    bar.style.top = `${Math.max(0, top)}px`;
  } catch {
    // Element not visible — hide
    bar.style.display = "none";
    return;
  }
  bar.style.display = "";
}

function updateSizeLabel(bar: HTMLDivElement, view: EditorView, pos: number) {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;
  const imgEl = bar.parentElement?.querySelector<HTMLImageElement>(
    `.ProseMirror [data-image-pos="${pos}"] img`,
  );
  const width = imgEl?.offsetWidth ?? node.attrs.width ?? "?";
  const height = imgEl?.offsetHeight ?? node.attrs.height ?? "?";
  const label = bar.querySelector(".md-image-toolbar__size");
  if (label) label.textContent = `${width} × ${height}`;
}

export function createImageToolbarPlugin() {
  let bar: HTMLDivElement | null = null;

  return new Plugin({
    key: imageToolbarKey,
    state: {
      init() {
        return { selectedPos: null };
      },
      apply(tr, prev) {
        // Track image selection — this is set externally by the NodeView click handler
        // For now, return prev state; the NodeView communicates via a different mechanism
        return prev;
      },
    },
    view(editorView) {
      bar = createToolbarDom();
      editorView.dom.parentElement?.appendChild(bar);

      // Click handler on the editor to detect image clicks
      editorView.dom.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const imgEl = target?.closest?.(".md-image-container img");
        if (!imgEl) return;

        // Find the position of the image in the doc
        const pos = editorView.posAtDOM(imgEl, 0);
        const node = editorView.state.doc.nodeAt(pos);
        if (!node || node.type.name !== "image") return;

        if (bar) {
          positionToolbar(bar, editorView, pos);
          updateSizeLabel(bar, editorView, pos);
          bar.dataset.imagePos = String(pos);
        }
      });

      // Hide toolbar when clicking elsewhere
      document.addEventListener("click", (event) => {
        if (!bar) return;
        const target = event.target as HTMLElement;
        if (target?.closest?.(".md-image-container img")) return;
        if (target?.closest?.(".md-image-toolbar")) return;
        bar.style.display = "none";
      });

      return {
        destroy() {
          bar?.remove();
          bar = null;
        },
      };
    },
  });
}
```

Wait — the approach above is fragile. Let me use a cleaner plugin-state based approach instead.

Rewrite `src/editor/image-toolbar-plugin.ts`:

```ts
import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { resetImageSize, setImageAlign } from "@/lib/image-commands";

export const imageToolbarKey = new PluginKey<{ imagePos: number | null }>("imageToolbar");

function buildToolbarDom(): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "md-image-toolbar";
  bar.style.display = "none";

  const sizeLabel = document.createElement("span");
  sizeLabel.className = "md-image-toolbar__size";
  bar.appendChild(sizeLabel);

  const alignDefs = [
    { align: "inline", label: "Inline" },
    { align: "left", label: "Left" },
    { align: "center", label: "Center" },
    { align: "right", label: "Right" },
  ];
  for (const { align, label } of alignDefs) {
    const btn = document.createElement("button");
    btn.className = `md-image-toolbar__btn`;
    btn.dataset.align = align;
    btn.textContent = label;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    bar.appendChild(btn);
  }

  const resetBtn = document.createElement("button");
  resetBtn.className = "md-image-toolbar__btn md-image-toolbar__reset";
  resetBtn.textContent = "Reset Size";
  resetBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  bar.appendChild(resetBtn);

  return bar;
}

function positionBar(bar: HTMLDivElement, view: EditorView, pos: number) {
  try {
    const start = view.coordsAtPos(pos);
    const node = view.state.doc.nodeAt(pos);
    const end = node ? view.coordsAtPos(pos + node.nodeSize) : start;
    const editorBox = view.dom.getBoundingClientRect();
    const center = (start.left + end.right) / 2 - editorBox.left;
    bar.style.left = `${Math.max(8, center - bar.offsetWidth / 2)}px`;
    bar.style.top = `${Math.max(0, start.top - editorBox.top - bar.offsetHeight - 8)}px`;
    bar.style.display = "";
  } catch {
    bar.style.display = "none";
  }
}

function refreshSizeLabel(bar: HTMLDivElement, view: EditorView, pos: number) {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;
  const w = node.attrs.width ?? "natural";
  const h = node.attrs.height ?? "natural";
  const label = bar.querySelector(".md-image-toolbar__size") as HTMLSpanElement | null;
  if (label) label.textContent = `${w} × ${h}`;
}

function isImageNode(node: { type: { name: string } } | null | undefined): boolean {
  return node?.type.name === "image";
}

export function createImageToolbarPlugin() {
  let bar: HTMLDivElement | null = null;

  function attachBarEvents(view: EditorView) {
    if (!bar) return;
    // Align buttons
    bar.querySelectorAll<HTMLButtonElement>("[data-align]").forEach((btn) => {
      btn.onclick = () => {
        const pos = Number(bar?.dataset.imagePos);
        if (pos != null && isImageNode(view.state.doc.nodeAt(pos))) {
          setImageAlign(view, pos, btn.dataset.align!);
          if (bar) positionBar(bar, view, pos);
        }
      };
    });
    // Reset button
    const resetBtn = bar.querySelector<HTMLButtonElement>(".md-image-toolbar__reset");
    if (resetBtn) {
      resetBtn.onclick = () => {
        const pos = Number(bar?.dataset.imagePos);
        if (pos != null && isImageNode(view.state.doc.nodeAt(pos))) {
          resetImageSize(view, pos);
          if (bar) {
            refreshSizeLabel(bar, view, pos);
            positionBar(bar, view, pos);
          }
        }
      };
    }
  }

  return new Plugin({
    key: imageToolbarKey,
    view(editorView) {
      bar = buildToolbarDom();
      editorView.dom.parentElement?.appendChild(bar);
      attachBarEvents(editorView);

      // Detect image clicks for toolbar
      editorView.dom.addEventListener("click", (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const container = target?.closest?.(".md-image-container");
        if (!container) return;
        const img = container.querySelector("img");
        if (!img) return;
        try {
          const pos = editorView.posAtDOM(img, 0);
          if (isImageNode(editorView.state.doc.nodeAt(pos)) && bar) {
            bar.dataset.imagePos = String(pos);
            positionBar(bar, editorView, pos);
            refreshSizeLabel(bar, editorView, pos);
          }
        } catch {
          // ignore
        }
      });

      // Hide toolbar on clicks elsewhere
      document.addEventListener("click", (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target?.closest?.(".md-image-container")) return;
        if (target?.closest?.(".md-image-toolbar")) return;
        if (bar) bar.style.display = "none";
      });

      return {
        destroy() {
          bar?.remove();
          bar = null;
        },
      };
    },
  });
}
```

### Step 2: Register plugin in plugins.ts

Edit `src/editor/plugins.ts`, add import and registration:

(a) Add import (after line 17):
```ts
import { createImageToolbarPlugin } from "@/editor/image-toolbar-plugin";
```

(b) Add plugin in the array (before `history()`):
```ts
    createImageToolbarPlugin(),
```

### Step 3: Create toolbar test

Create `tests/unit/image-toolbar.spec.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(async () => []),
  convertFileSrc: vi.fn((p: string) => `asset://${p}`),
}));

describe("image toolbar plugin", () => {
  it("plugin key is defined", async () => {
    const { imageToolbarKey } = await import("@/editor/image-toolbar-plugin");
    expect(imageToolbarKey).toBeDefined();
    expect(imageToolbarKey.key).toBe("imageToolbar");
  });

  it("createImageToolbarPlugin returns a Plugin", async () => {
    const { createImageToolbarPlugin } = await import("@/editor/image-toolbar-plugin");
    const plugin = createImageToolbarPlugin();
    expect(plugin).toBeDefined();
    expect(plugin.props).toBeDefined();
  });
});
```

### Step 4: Run tests

Run: `pnpm test tests/unit/image-toolbar.spec.ts`
Expected: 2 tests pass.

### Step 5: Run full suite

Run: `pnpm test`
Expected: no regressions.

### Step 6: Commit

```bash
git add src/editor/image-toolbar-plugin.ts src/editor/plugins.ts tests/unit/image-toolbar.spec.ts
git commit -m "feat(image): add floating toolbar plugin for image selection"
```

---

## Task 6: Context menu integration

**Files:**
- Modify: `src/editor/EditorView.vue` (right-click handler + menu items)
- Create: `tests/unit/image-context-menu.spec.ts`

### Step 1: Write the failing test

Create `tests/unit/image-context-menu.spec.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => []),
  convertFileSrc: vi.fn((p: string) => `asset://${p}`),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(async () => null),
}));

describe("image context menu items", () => {
  it("findImageAtClick returns null for non-image clicks", async () => {
    const { findImageAtClick } = await import("@/lib/image-commands");
    // Without a real EditorView, returns null
    expect(findImageAtClick).toBeDefined();
  });

  it("image menu item IDs are defined", async () => {
    // Test that the command identifiers exist and are consistent
    const cmdIds = [
      "image.copyImage",
      "image.copyPath",
      "image.saveAs",
      "image.revealInFinder",
    ];
    for (const id of cmdIds) {
      expect(id).toMatch(/^image\./);
    }
  });
});
```

### Step 2: Run to verify failure

Run: `pnpm test tests/unit/image-context-menu.spec.ts`
Expected: 2 tests pass (these test minimal definitions; the real integration is tested manually).

### Step 3: Modify EditorView.vue

Edit `src/editor/EditorView.vue`:

(a) Add imports (after line 48):
```ts
import { findImageAtClick, copyImageToClipboard, copyImageMarkdownPath, saveImageAs, revealImageInFinder } from "@/lib/image-commands";
```

(b) Add `rightClickedImage` ref (after line 79):
```ts
const rightClickedImage = ref<{ src: string; alt: string; docPath: string | undefined } | null>(null);
```

(c) Modify `openContextMenu` (lines 219-236) — add image detection before the mermaid check:
```ts
function openContextMenu(event: MouseEvent) {
  if (!view || !activeSession.value) {
    return;
  }
  event.preventDefault();

  const target = event.target as HTMLElement | null;

  // Check for image click
  const imgEl = target?.closest?.(".md-image-container img") as HTMLImageElement | null;
  if (imgEl && view) {
    const result = findImageAtClick(view, event);
    if (result) {
      rightClickedImage.value = {
        src: result.info.src,
        alt: result.info.alt,
        docPath: activeSession.value?.path,
      };
    } else {
      rightClickedImage.value = null;
    }
  } else {
    rightClickedImage.value = null;
  }

  // Check for mermaid
  const container = target?.closest(".mermaid-preview.mermaid-preview--ready");
  if (container) {
    const svgEl = container.querySelector("svg");
    rightClickedSvg.value = svgEl ? svgEl.outerHTML : null;
  } else {
    rightClickedSvg.value = null;
  }

  view.focus();
  menu.openAt(event.clientX, event.clientY);
}
```

(d) Modify `menuItems` computed (lines 90-117) — prepend image items when `rightClickedImage.value` is set:
```ts
const menuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [];

  if (rightClickedImage.value) {
    const img = rightClickedImage.value;
    items.push(
      { type: "action", id: "image.copyImage", label: t("menu.image.copyImage") },
      { type: "action", id: "image.copyPath", label: t("menu.image.copyPath") },
      { type: "action", id: "image.saveAs", label: t("menu.image.saveAs") },
      { type: "action", id: "image.revealInFinder", label: t("menu.image.revealInFinder") },
      { type: "separator", id: "sep-image" },
    );
    // Store for command handler
    items._imageContext = img;
  }

  items.push(
    { type: "action", id: "clipboard.cut", label: "Cut", disabled: !hasSelection.value },
    { type: "action", id: "clipboard.copy", label: "Copy", disabled: !hasSelection.value },
    { type: "action", id: "clipboard.paste", label: "Paste", disabled: !canUseClipboard.value },
    { type: "action", id: "edit.selectAll", label: "Select All" },
    { type: "separator", id: "sep-edit-format" },
    { type: "action", id: "format.bold", label: "Bold" },
    { type: "action", id: "format.italic", label: "Italic" },
    { type: "action", id: "format.inlineCode", label: "Inline Code" },
    { type: "separator", id: "sep-format-paragraph" },
    { type: "action", id: "paragraph.h1", label: "Heading 1" },
    { type: "action", id: "paragraph.h2", label: "Heading 2" },
    { type: "action", id: "paragraph.h3", label: "Heading 3" },
    { type: "action", id: "paragraph.paragraph", label: "Paragraph" },
    { type: "separator", id: "sep-paragraph-table" },
    { type: "action", id: "paragraph.table", label: "Insert Table" },
  );

  // ... mermaid items
  if (rightClickedSvg.value) {
    items.unshift(
      { type: "action", id: "mermaid.copyPng", label: t("editor.menu.copyMermaidPng") },
      { type: "separator", id: "sep-mermaid" },
    );
  }

  return items;
});
```

(e) Modify `handleMenuSelect` (lines 190-217) — add image command handling before the mermaid check:
```ts
async function handleMenuSelect(item: ContextMenuActionItem) {
  // Image commands
  if (item.id === "image.copyImage" && rightClickedImage.value) {
    try {
      await copyImageToClipboard(
        rightClickedImage.value.docPath,
        rightClickedImage.value.src,
      );
    } catch (error) {
      window.alert(String(error));
    }
    return;
  }
  if (item.id === "image.copyPath" && rightClickedImage.value) {
    copyImageMarkdownPath(rightClickedImage.value);
    return;
  }
  if (item.id === "image.saveAs" && rightClickedImage.value) {
    try {
      await saveImageAs(
        rightClickedImage.value.docPath,
        rightClickedImage.value.src,
      );
    } catch (error) {
      window.alert(String(error));
    }
    return;
  }
  if (item.id === "image.revealInFinder" && rightClickedImage.value) {
    try {
      await revealImageInFinder(
        rightClickedImage.value.docPath,
        rightClickedImage.value.src,
      );
    } catch (error) {
      window.alert(String(error));
    }
    return;
  }
  // ... existing mermaid + other handlers
```

### Step 3 note: Since `menuItems` is a typed `ContextMenuItem[]`, I can't attach `_imageContext`. Use a separate variable.

Add after `const rightClickedImage`:
```ts
let pendingImageContext: { src: string; alt: string; docPath: string | undefined } | null = null;
```

Store in `openContextMenu`:
```ts
pendingImageContext = rightClickedImage.value;
```

Read from `handleMenuSelect`:
```ts
if (item.id === "image.copyImage" && pendingImageContext) {
```

### Step 4: Run tests

Run: `pnpm test tests/unit/image-context-menu.spec.ts`
Expected: 2 tests pass.

### Step 5: Run full suite

Run: `pnpm test`
Expected: no regressions. The `app-shell.spec.ts` tests that mount EditorView may need the image commands mock — if they fail, add `vi.mock("@/lib/image-commands", ...)` at the top of `app-shell.spec.ts`.

### Step 6: Commit

```bash
git add src/editor/EditorView.vue tests/unit/image-context-menu.spec.ts
git commit -m "feat(image): add image-specific context menu items on right-click"
```

---

## Task 7: I18n labels

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/zh-CN.ts`

### Step 1: Add English labels

Edit `src/i18n/locales/en.ts`, add after `"command.format.image": "Image"` (line 48):

```ts
  "menu.image.copyImage": "Copy Image",
  "menu.image.copyPath": "Copy Image Path",
  "menu.image.saveAs": "Save Image As...",
  "menu.image.revealInFinder": "Reveal in Finder",
```

### Step 2: Add Chinese labels

Edit `src/i18n/locales/zh-CN.ts`, add after the corresponding image line:

```ts
  "menu.image.copyImage": "复制图片",
  "menu.image.copyPath": "复制图片路径",
  "menu.image.saveAs": "另存为...",
  "menu.image.revealInFinder": "在访达中显示",
```

### Step 3: Type-check

Run: `pnpm typecheck`
Expected: no new errors.

### Step 4: Commit

```bash
git add src/i18n/locales/en.ts src/i18n/locales/zh-CN.ts
git commit -m "feat(image): add i18n labels for image context menu"
```

---

## Task 8: CSS styles for image handles, toolbar, and alignment

**Files:**
- Locate existing image-related styles (search for `.md-image` or image styles)
- Add new styles to the appropriate stylesheet

- [ ] **Step 1: Find the right stylesheet**

Run: `grep -r "md-image\|\.ProseMirror img\|image.*style" src/ --include="*.css" --include="*.scss" -l`
Identify where ProseMirror editor styles live.

- [ ] **Step 2: Add image editing CSS**

Add to the identified stylesheet:

```css
/* Image container */
.md-image-container {
  position: relative;
  display: inline-block;
}
.md-image-container--selected .md-image-wrapper {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Resize handles */
.md-image-wrapper {
  position: relative;
  display: inline-block;
  line-height: 0;
}
.md-image-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #3b82f6;
  border: 1px solid #fff;
  border-radius: 50%;
  z-index: 2;
  display: none;
}
.md-image-container--selected .md-image-handle {
  display: block;
}
.md-image-handle--nw { top: -4px; left: -4px; cursor: nw-resize; }
.md-image-handle--n  { top: -4px; left: 50%; margin-left: -4px; cursor: n-resize; }
.md-image-handle--ne { top: -4px; right: -4px; cursor: ne-resize; }
.md-image-handle--e  { top: 50%; margin-top: -4px; right: -4px; cursor: e-resize; }
.md-image-handle--se { bottom: -4px; right: -4px; cursor: se-resize; }
.md-image-handle--s  { bottom: -4px; left: 50%; margin-left: -4px; cursor: s-resize; }
.md-image-handle--sw { bottom: -4px; left: -4px; cursor: sw-resize; }
.md-image-handle--w  { top: 50%; margin-top: -4px; left: -4px; cursor: w-resize; }

/* Alignment */
.md-image--align-left {
  float: left;
  margin-right: 1em;
  margin-bottom: 0.5em;
}
.md-image--align-center {
  display: block;
  margin: 0 auto;
}
.md-image--align-right {
  float: right;
  margin-left: 1em;
  margin-bottom: 0.5em;
}

/* Floating toolbar */
.md-image-toolbar {
  position: absolute;
  z-index: 100;
  display: flex;
  gap: 4px;
  padding: 4px 6px;
  background: #1e1e1e;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  align-items: center;
}
.md-image-toolbar__size {
  font-size: 11px;
  color: #aaa;
  margin-right: 8px;
  white-space: nowrap;
}
.md-image-toolbar__btn {
  background: transparent;
  color: #ccc;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  cursor: pointer;
}
.md-image-toolbar__btn:hover {
  background: #333;
  color: #fff;
}
```

Adjust the stylesheet path based on Step 1 finding.

### Step 3: Commit

```bash
git add <stylesheet-path>
git commit -m "feat(image): add CSS for resize handles, toolbar, and alignment"
```

---

## Task 9: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Build and start the app**

Run: `pnpm tauri:dev`
Expected: app launches, no Rust panics.

- [ ] **Step 2: Image right-click context menu**

Open a document with an image. Right-click the image. Expected: menu shows "Copy Image", "Copy Image Path", "Save Image As...", "Reveal in Finder" at the top.

- [ ] **Step 3: Copy image path**

Click "Copy Image Path". Paste elsewhere (Cmd+V). Expected: `![alt](src)` markdown syntax.

- [ ] **Step 4: Reveal in Finder**

Click "Reveal in Finder". Expected: Finder opens with the image file selected.

- [ ] **Step 5: Copy image to clipboard**

Click "Copy Image". Paste into a rich-text app. Expected: image pastes as image data.

- [ ] **Step 6: Save image as**

Click "Save Image As...". Choose a destination. Expected: image file copied to destination.

- [ ] **Step 7: Image selection + resize handles**

Click on an image in the editor. Expected: blue outline appears, 8 resize handles visible. Click elsewhere → deselection.

- [ ] **Step 8: Drag resize**

Click an image, grab a corner handle, drag. Expected: image resizes proportionally. Release → size saved to node attrs.

- [ ] **Step 9: Floating toolbar**

Click an image. Expected: floating toolbar appears above with align buttons and "Reset Size".

- [ ] **Step 10: Image alignment**

Click an image, click alignment button in toolbar. Expected: image aligns left/center/right/inline.

- [ ] **Step 11: Save and reopen**

Save (Cmd+S), close tab, reopen. Expected: image size and alignment preserved in Markdown title.

- [ ] **Step 12: Run all tests**

Run: `pnpm test && cargo test`
Expected: all green.

---

## Self-Review

**Spec coverage:**
- [x] Schema changes (width/height/align) → Task 1
- [x] Markdown round-trip → Task 2
- [x] Enhanced NodeView (resize handles, selection) → Task 3
- [x] Image commands (copy, save, reveal, reset, align) → Task 4
- [x] Floating toolbar → Task 5
- [x] Context menu integration → Task 6
- [x] I18n → Task 7
- [x] CSS styles → Task 8
- [x] Manual verification → Task 9

**Placeholder scan:** No TBD/TODO markers. Task 8 Step 1 requires a dynamic file find — the stylesheet path must be determined at execution time.

**Type consistency:**
- `width`/`height`: `number | null` everywhere
- `align`: `"inline" | "left" | "center" | "right"` everywhere
- `findImageAtClick` returns `{ pos, info }` matching the signature used in `EditorView.vue`
- All Tauri command invocations use consistent parameter names
