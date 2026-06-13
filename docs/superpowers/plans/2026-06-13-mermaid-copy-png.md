# Mermaid Copy Diagram as PNG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-click "Copy Diagram as PNG" context menu option for Mermaid diagram previews, converting the SVG to PNG with a white background and copying it to the clipboard.

**Architecture:** Detect context menu events within `.mermaid-preview--ready` elements inside `EditorView.vue`, save the SVG outer HTML, display a localized copy action, and utilize a Canvas-based helper in `src/lib/image-helpers.ts` to convert and write the PNG blob to the clipboard.

**Tech Stack:** Vue 3, TypeScript, ProseMirror, HTML Canvas API, Clipboard API, Vitest.

---

### Task 1: Add Translation Keys

**Files:**
- Modify: `src/i18n/locales/en.ts:1-76`
- Modify: `src/i18n/locales/zh-CN.ts:1-76`

- [ ] **Step 1: Read the existing locales**
  Ensure we have loaded `en.ts` and `zh-CN.ts` to inspect their trailing properties.

- [ ] **Step 2: Add english key for copying Mermaid as PNG**
  Add `"editor.menu.copyMermaidPng": "Copy Diagram as PNG"` to `src/i18n/locales/en.ts`.
  
  ```typescript
  export const en = {
    // ... existing keys
    "command.export.word": "Export Word",
    "editor.menu.copyMermaidPng": "Copy Diagram as PNG",
  } as const;
  ```

- [ ] **Step 3: Add Chinese key for copying Mermaid as PNG**
  Add `"editor.menu.copyMermaidPng": "复制图表为 PNG"` to `src/i18n/locales/zh-CN.ts`.
  
  ```typescript
  export const zhCN = {
    // ... existing keys
    "command.export.word": "导出 Word",
    "editor.menu.copyMermaidPng": "复制图表为 PNG",
  } as const;
  ```

- [ ] **Step 4: Commit translation changes**
  ```bash
  git add src/i18n/locales/en.ts src/i18n/locales/zh-CN.ts
  git commit -m "feat: add localization keys for copying mermaid diagram as png"
  ```

---

### Task 2: Implement SVG to PNG Converter Helper

**Files:**
- Create: `src/lib/image-helpers.ts`

- [ ] **Step 1: Write the SVG to PNG Blob converter function**
  Create a new helper file at `src/lib/image-helpers.ts` with the following content:
  
  ```typescript
  export async function convertSvgToPngBlob(svgHtml: string): Promise<Blob> {
    const blob = new Blob([svgHtml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load SVG image"));
        img.src = url;
      });

      const width = Math.max(Math.ceil(image.naturalWidth || image.width || 800), 1);
      const height = Math.max(Math.ceil(image.naturalHeight || image.height || 400), 1);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas context is unavailable");
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!pngBlob) {
        throw new Error("Failed to convert SVG to PNG Blob");
      }

      return pngBlob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  ```

- [ ] **Step 2: Commit helper function**
  ```bash
  git add src/lib/image-helpers.ts
  git commit -m "feat: implement convertSvgToPngBlob helper"
  ```

---

### Task 3: Add Unit Tests for Image Helpers

**Files:**
- Create: `tests/unit/image-helpers.spec.ts`

- [ ] **Step 1: Create unit test file**
  Add mock and assertion logic mimicking `export-word.spec.ts` at `tests/unit/image-helpers.spec.ts`:
  
  ```typescript
  import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
  import { convertSvgToPngBlob } from "../../src/lib/image-helpers";

  describe("image-helpers", () => {
    let mockCanvas: any;

    beforeEach(() => {
      // Stub global Image
      class FakeImage {
        width = 400;
        height = 300;
        naturalWidth = 400;
        naturalHeight = 300;
        private _src = "";
        onload: () => void = () => {};
        
        get src() {
          return this._src;
        }
        
        set src(val: string) {
          this._src = val;
          setTimeout(() => this.onload(), 0);
        }
      }

      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: FakeImage,
      });

      vi.stubGlobal("URL", Object.assign(globalThis.URL || {}, {
        createObjectURL: vi.fn(() => "blob:test-svg"),
        revokeObjectURL: vi.fn(),
      }));

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          fillStyle: "",
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        })),
        toBlob: (cb: (blob: Blob) => void) => cb(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })),
      };

      vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
        if (tagName === "canvas") {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return document.createElement(tagName);
      }) as typeof document.createElement);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("successfully converts svg to png blob with white background", async () => {
      const svg = `<svg><rect width="100" height="100"/></svg>`;
      const blob = await convertSvgToPngBlob(svg);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("image/png");
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run unit tests to verify**
  Run: `pnpm test tests/unit/image-helpers.spec.ts`
  Expected: PASS

- [ ] **Step 3: Commit tests**
  ```bash
  git add tests/unit/image-helpers.spec.ts
  git commit -m "test: add unit tests for convertSvgToPngBlob"
  ```

---

### Task 4: Integrate Context Menu and PNG Copy in EditorView.vue

**Files:**
- Modify: `src/editor/EditorView.vue`

- [ ] **Step 1: Read current EditorView.vue**
  Ensure we read `src/editor/EditorView.vue` before modifying it to preserve exact indentation.

- [ ] **Step 2: Import dependencies and useI18n**
  Import `ref` (if not already imported), `useI18n` (if not already imported), and `convertSvgToPngBlob`.
  
  ```typescript
  import { useI18n } from "@/composables/useI18n";
  import { convertSvgToPngBlob } from "@/lib/image-helpers";
  ```

- [ ] **Step 3: Add rightClickedSvg reference and useI18n inside script setup**
  ```typescript
  const { t } = useI18n();
  const rightClickedSvg = ref<string | null>(null);
  ```

- [ ] **Step 4: Update openContextMenu to detect Mermaid diagram previews**
  Modify `openContextMenu` function:
  
  ```typescript
  function openContextMenu(event: MouseEvent) {
    if (!view || !activeSession.value) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const mermaidPreview = target?.closest(".mermaid-preview");
    if (mermaidPreview && mermaidPreview.classList.contains("mermaid-preview--ready")) {
      const svgEl = mermaidPreview.querySelector("svg");
      if (svgEl) {
        rightClickedSvg.value = svgEl.outerHTML;
      } else {
        rightClickedSvg.value = null;
      }
    } else {
      rightClickedSvg.value = null;
    }

    event.preventDefault();
    view.focus();
    menu.openAt(event.clientX, event.clientY);
  }
  ```

- [ ] **Step 5: Inject copy action into menuItems computed property**
  Modify `menuItems` definition to prepend the option when `rightClickedSvg.value` is present:
  
  ```typescript
  const menuItems = computed<ContextMenuItem[]>(() => {
    const baseItems: ContextMenuItem[] = [
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
    ];

    if (rightClickedSvg.value) {
      return [
        { type: "action", id: "mermaid.copyPng", label: t("editor.menu.copyMermaidPng") },
        { type: "separator", id: "sep-mermaid" },
        ...baseItems,
      ];
    }
    return baseItems;
  });
  ```

- [ ] **Step 6: Handle menu item click in handleMenuSelect**
  Modify `handleMenuSelect`:
  
  ```typescript
  async function handleMenuSelect(item: ContextMenuActionItem) {
    if (item.id === "mermaid.copyPng") {
      if (rightClickedSvg.value) {
        try {
          const pngBlob = await convertSvgToPngBlob(rightClickedSvg.value);
          await window.navigator.clipboard.write([
            new ClipboardItem({
              "image/png": pngBlob,
            }),
          ]);
        } catch (err) {
          console.error("Failed to copy Mermaid as PNG:", err);
          window.alert("Failed to copy diagram as PNG");
        }
      }
      return;
    }
    if (item.id === "clipboard.cut") {
      // ... existing logic
  ```

- [ ] **Step 7: Commit EditorView integration**
  ```bash
  git add src/editor/EditorView.vue
  git commit -m "feat: integrate right-click copy mermaid diagram as png in EditorView"
  ```

---

### Task 5: Verification and Quality Assurance

- [ ] **Step 1: Run all unit tests**
  Run: `pnpm test`
  Expected: PASS

- [ ] **Step 2: Run typechecker**
  Run: `pnpm typecheck`
  Expected: PASS

- [ ] **Step 3: Run linter**
  Run: `pnpm lint`
  Expected: PASS

- [ ] **Step 4: Update the feature-list document**
  Review `docs/product/feature-list.md` and update status.
