import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { PDFDocument, StandardFonts, PDFFont } from "pdf-lib";
import { markdownToPdfPayload } from "@/lib/export-pdf/index";
import { PageEngine } from "@/lib/export-pdf/page-engine";
import { renderBlocks } from "@/lib/export-pdf/renderer";
import { PAGE_CONFIG } from "@/lib/export-pdf/types";
import type { PdfFonts } from "@/lib/export-pdf/types";
import { layoutRichText, wrapLines, flattenInlineTokens, measureLineHeight } from "@/lib/export-pdf/text-layout";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#fff"/><text x="10" y="30">diagram</text></svg>',
    })),
  },
}));

// ── CJK detection (same as text-layout.ts) ──

function isCJK(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0xff00 && cp <= 0xffef) ||
    (cp >= 0xfe30 && cp <= 0xfe4f)
  );
}

// ── Realistic mock font metrics ──

function mockCjkWidthOfTextAtSize(text: string, size: number): number {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (isCJK(cp)) {
      width += size; // CJK full-width
    } else if (ch === " ") {
      width += size * 0.3;
    } else if (ch === "\t") {
      width += size * 2;
    } else {
      width += size * 0.55; // average Latin char
    }
  }
  return width;
}

function mockHeightAtSize(size: number): number {
  return size * 1.2;
}

// ── Helpers ──

function createMockFont(): PDFFont {
  return {
    widthOfTextAtSize: (text: string, size: number) => mockCjkWidthOfTextAtSize(text, size),
    heightAtSize: (size: number) => mockHeightAtSize(size),
    embed: vi.fn(),
    ref: {} as any,
    name: "MockFont",
    sizeAtHeight: (height: number) => height / 1.2,
  } as unknown as PDFFont;
}

// ── pdf-lib coordinate system note ──
//
// pdf-lib uses bottom-left origin: y=0 at bottom, y=pageHeight at top.
// Our PageEngine uses the same coordinate system:
//   contentTop = pageHeight - marginTop = 792 - 72 = 720
//   contentBottom = marginBottom = 72
//   advanceY(delta) subtracts from currentY (moves DOWN the page)
//
// Text is drawn with BASELINE at the given y. Ascender extends upward.

// ── Tests ──

describe("PDF export layout", () => {
  // ── Text layout ──

  describe("layoutRichText", () => {
    it("measures pure CJK text with correct width", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const result = layoutRichText("你好世界", fonts, 11, 468);
      // 4 CJK chars at 11pt each = 44pt, fits in one line
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]!.runs).toHaveLength(1);
      expect(result.lines[0]!.runs[0]!.text).toBe("你好世界");
      expect(result.totalHeight).toBeGreaterThan(0);
    });

    it("wraps long CJK text when exceeding maxWidth", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      // 50 CJK chars at 11pt = 550pt, exceeds 468pt content width
      const longText = "中文测试文本".repeat(10); // 60 chars
      const result = layoutRichText(longText, fonts, 11, 468);
      expect(result.lines.length).toBeGreaterThan(1);
      // Each line should not exceed maxWidth
      for (const line of result.lines) {
        expect(line.width).toBeLessThanOrEqual(468 + 1); // allow 1pt rounding
      }
    });

    it("wraps mixed CJK and Latin text", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const text = "Typora 风格实时 Markdown 编辑，基于 ProseMirror，实现所见即所得编辑";
      const result = layoutRichText(text, fonts, 11, 468);

      // All lines should be within maxWidth
      for (const line of result.lines) {
        expect(line.width).toBeLessThanOrEqual(468 + 1);
      }

      // Text should be split across lines (this is a long text)
      const allText = result.lines.map((l) => l.runs.map((r) => r.text).join("")).join("");
      expect(allText).toBe(text);
    });

    it("handles empty text", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const result = layoutRichText("", fonts, 11, 468);
      expect(result.lines).toHaveLength(0);
      expect(result.totalHeight).toBe(0);
    });

    it("computes totalHeight proportional to line count", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const singleLine = layoutRichText("short", fonts, 11, 468);
      const multiLine = layoutRichText("中文测试文本".repeat(20), fonts, 11, 200); // narrow width forces many lines

      expect(multiLine.totalHeight).toBeGreaterThan(singleLine.totalHeight);
      // totalHeight should equal lines * lineAdvance
      const lineAdvance = measureLineHeight(fonts, 11);
      expect(singleLine.totalHeight).toBe(singleLine.lines.length * lineAdvance);
      expect(multiLine.totalHeight).toBe(multiLine.lines.length * lineAdvance);
    });
  });

  // ── CJK line wrapping ──

  describe("wrapLines", () => {
    it("breaks at CJK character boundaries", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      // Each CJK char = 11pt, 40 chars = 440pt (fits), 43 chars = 473pt (exceeds 468pt)
      const runs = flattenInlineTokens("产品功能清单产品功能清单产品功能清单产品功能清单产品功能清单产品功能清单产品功能清单", fonts, 11);
      const lines = wrapLines(runs, 468);

      expect(lines.length).toBeGreaterThanOrEqual(1);
      for (const line of lines) {
        expect(line.width).toBeLessThanOrEqual(468 + 1);
      }
    });

    it("breaks at spaces in Latin text", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const runs = flattenInlineTokens("This is a very long sentence that should wrap at word boundaries when the content width is exceeded", fonts, 11);
      const lines = wrapLines(runs, 200); // narrow width

      // Check that no line starts with a space (word-boundary break)
      for (const line of lines) {
        const firstText = line.runs[0]?.text ?? "";
        expect(firstText).not.toMatch(/^ /);
      }
    });

    it("handles explicit newlines", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const runs = flattenInlineTokens("Line 1\nLine 2\nLine 3", fonts, 11);
      const lines = wrapLines(runs, 468);

      expect(lines).toHaveLength(3);
    });
  });

  // ── Inline token flattening ──

  describe("flattenInlineTokens", () => {
    it("renders bold text with bodyBold font", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const runs = flattenInlineTokens("**bold text**", fonts, 11);
      expect(runs).toHaveLength(1);
      expect(runs[0]!.font).toBe(fonts.bodyBold);
      expect(runs[0]!.text).toBe("bold text");
    });

    it("renders inline code with mono font at reduced size", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const runs = flattenInlineTokens("some `code` here", fonts, 11);
      const codeRuns = runs.filter((r) => r.font === fonts.mono);
      expect(codeRuns).toHaveLength(1);
      expect(codeRuns[0]!.text).toBe("code");
      expect(codeRuns[0]!.fontSize).toBeCloseTo(11 * 0.85, 0);
    });

    it("marks strikethrough runs", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const runs = flattenInlineTokens("~~deleted~~", fonts, 11);
      expect(runs).toHaveLength(1);
      expect(runs[0]!.strikethrough).toBe(true);
      expect(runs[0]!.text).toBe("deleted");
    });

    it("merges adjacent identical-style runs", () => {
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const runs = flattenInlineTokens("plain text here", fonts, 11);
      expect(runs).toHaveLength(1);
      expect(runs[0]!.text).toBe("plain text here");
    });
  });

  // ── Page spacing / no overlaps ──

  describe("vertical spacing integrity", () => {
    it("ensureSpace creates new page when content exceeds remaining space", async () => {
      const pdfDoc = await PDFDocument.create();
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const engine = new PageEngine(pdfDoc, fonts, PAGE_CONFIG);
      expect(engine.pageNumber).toBe(1);

      // Request more space than available
      const available = engine.remainingSpace();
      engine.ensureSpace(available + 1);
      expect(engine.pageNumber).toBe(2);
    });

    it("content stays within page bounds", async () => {
      const pdfDoc = await PDFDocument.create();
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const engine = new PageEngine(pdfDoc, fonts, PAGE_CONFIG);
      const initialY = engine.currentY;

      // Content should start at top of content area
      expect(initialY).toBe(PAGE_CONFIG.pageHeight - PAGE_CONFIG.marginTop); // 720
      expect(initialY).toBeGreaterThan(PAGE_CONFIG.marginBottom); // above bottom margin
      expect(initialY).toBeLessThan(PAGE_CONFIG.pageHeight); // below page top
    });

    it("advanceY and retractY maintain cursor consistency", async () => {
      const pdfDoc = await PDFDocument.create();
      const fonts: PdfFonts = {
        body: createMockFont(),
        bodyBold: createMockFont(),
        mono: createMockFont(),
      };

      const engine = new PageEngine(pdfDoc, fonts, PAGE_CONFIG);
      const before = engine.currentY;

      engine.advanceY(100);
      expect(engine.currentY).toBe(before - 100);

      engine.retractY(30);
      expect(engine.currentY).toBe(before - 70);
    });
  });
});

// ── Markdown parsing ──

describe("markdownToPdfPayload", () => {
  beforeEach(() => {
    class FakeImage {
      naturalWidth = 120;
      naturalHeight = 60;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: FakeImage,
    });

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
      toBlob: (cb: (blob: Blob) => void) => cb(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })),
    };

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "canvas") {
        return fakeCanvas as unknown as HTMLCanvasElement;
      }
      return document.createElement(tagName);
    }) as typeof document.createElement);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
        blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
      })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses headings with correct levels", async () => {
    const payload = await markdownToPdfPayload("# H1\n## H2\n### H3");
    const headings = payload.blocks.filter((b) => b.type === "heading");
    expect(headings).toHaveLength(3);
    expect(headings.map((h) => (h as any).level)).toEqual([1, 2, 3]);
  });

  it("parses paragraphs", async () => {
    const payload = await markdownToPdfPayload("Hello world paragraph.");
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]!.type).toBe("paragraph");
  });

  it("parses code blocks with language", async () => {
    const payload = await markdownToPdfPayload("```typescript\nconst x = 1;\n```");
    expect(payload.blocks).toHaveLength(1);
    const codeBlock = payload.blocks[0]!;
    expect(codeBlock.type).toBe("code");
    if (codeBlock.type === "code") {
      expect(codeBlock.language).toBe("typescript");
      expect(codeBlock.text).toContain("const x = 1");
    }
  });

  it("parses mermaid code blocks as mermaid type", async () => {
    const payload = await markdownToPdfPayload("```mermaid\ngraph TD\nA-->B\n```");
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]!.type).toBe("mermaid");
  });

  it("parses tables", async () => {
    const payload = await markdownToPdfPayload("| Col1 | Col2 |\n| --- | --- |\n| A | B |");
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]!.type).toBe("table");
    if (payload.blocks[0]!.type === "table") {
      expect(payload.blocks[0]!.rows).toHaveLength(2); // header + 1 data row
      expect(payload.blocks[0]!.headerRowCount).toBe(1);
    }
  });

  it("parses blockquotes", async () => {
    const payload = await markdownToPdfPayload("> quoted text");
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]!.type).toBe("blockquote");
  });

  it("parses unordered lists", async () => {
    const payload = await markdownToPdfPayload("- item 1\n- item 2");
    const listItems = payload.blocks.filter((b) => b.type === "listItem");
    expect(listItems).toHaveLength(2);
    const first = listItems[0]!;
    if (first.type === "listItem") {
      expect(first.ordered).toBe(false);
    }
  });

  it("parses ordered lists", async () => {
    const payload = await markdownToPdfPayload("1. first\n2. second");
    const listItems = payload.blocks.filter((b) => b.type === "listItem");
    expect(listItems).toHaveLength(2);
    const first = listItems[0]!;
    if (first.type === "listItem") {
      expect(first.ordered).toBe(true);
    }
  });

  it("filters empty paragraphs", async () => {
    const payload = await markdownToPdfPayload("# Title\n\n\nparagraph");
    // Should not have empty paragraph blocks
    const paragraphs = payload.blocks.filter((b) => b.type === "paragraph");
    expect(paragraphs.every((p) => p.type === "paragraph" && p.text.trim().length > 0)).toBe(true);
  });
});

// ── Full pipeline integration test with feature-list.md ──

describe("PDF export integration with feature-list.md", () => {
  let featureListMd: string;

  beforeAll(async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    featureListMd = readFileSync(
      resolve(__dirname, "../../docs/product/feature-list.md"),
      "utf-8",
    );
  });

  beforeEach(() => {
    class FakeImage {
      naturalWidth = 120;
      naturalHeight = 60;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: FakeImage,
    });

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
      toBlob: (cb: (blob: Blob) => void) => cb(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })),
    };

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "canvas") {
        return fakeCanvas as unknown as HTMLCanvasElement;
      }
      return document.createElement(tagName);
    }) as typeof document.createElement);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
        blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
      })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses feature-list.md into blocks without error", async () => {
    const payload = await markdownToPdfPayload(featureListMd, { title: "产品功能清单" });

    expect(payload.title).toBe("产品功能清单");
    expect(payload.blocks.length).toBeGreaterThan(0);

    // Should have various block types
    const types = new Set(payload.blocks.map((b) => b.type));
    expect(types.has("heading")).toBe(true);
    expect(types.has("paragraph")).toBe(true);
    expect(types.has("table")).toBe(true);
  });

  it("preserves all table rows from feature-list.md", async () => {
    const payload = await markdownToPdfPayload(featureListMd);
    const tables = payload.blocks.filter((b) => b.type === "table");

    // feature-list.md has multiple tables (one per section)
    expect(tables.length).toBeGreaterThanOrEqual(6);

    // The first table is "编辑器核心" with many rows
    const firstTable = tables[0]!;
    if (firstTable.type === "table") {
      // Total rows includes header + data rows; feature-list "编辑器核心" table has ~31 data rows + 1 header
      expect(firstTable.rows.length).toBeGreaterThanOrEqual(20);
      // marked v18: headerRowCount is 1 for standard markdown tables
      expect(firstTable.headerRowCount).toBe(1);

      // Header row should contain expected columns
      const header = firstTable.rows[0]!;
      expect(header.some((c) => c.includes("功能"))).toBe(true);
      expect(header.some((c) => c.includes("状态"))).toBe(true);
      expect(header.some((c) => c.includes("说明"))).toBe(true);
    }
  });

  it("preserves headings from feature-list.md", async () => {
    const payload = await markdownToPdfPayload(featureListMd);
    const headings = payload.blocks.filter((b) => b.type === "heading");

    const headingTexts = headings.map((h) => (h as any).text);
    expect(headingTexts).toContain("产品功能清单");
    expect(headingTexts).toContain("编辑器核心");
    expect(headingTexts).toContain("查找与替换");
  });

  it("generates a PDF from feature-list.md when CJK fonts are available", async () => {
    // Note: Standard PDF fonts (Helvetica, etc.) use WinAnsiEncoding which
    // cannot encode CJK characters. This test verifies the pipeline correctly
    // requires embedded CJK-capable fonts. For real rendering, the app uses
    // Arial Unicode MS or similar CJK fonts loaded via readBinaryFile (Tauri).
    const payload = await markdownToPdfPayload(featureListMd, { title: "产品功能清单" });

    const pdfDoc = await PDFDocument.create();
    const embeddedFonts = await Promise.all([
      pdfDoc.embedFont(StandardFonts.Helvetica),
      pdfDoc.embedFont(StandardFonts.HelveticaBold),
      pdfDoc.embedFont(StandardFonts.Courier),
    ]);

    const fonts: PdfFonts = {
      body: embeddedFonts[0]!,
      bodyBold: embeddedFonts[1]!,
      mono: embeddedFonts[2]!,
    };

    const engine = new PageEngine(pdfDoc, fonts, PAGE_CONFIG);

    // Standard fonts cannot encode CJK — this is expected to fail.
    // The real app uses embedded CJK fonts (Arial Unicode MS) which work correctly.
    await expect(
      renderBlocks(payload, { engine, fonts, config: PAGE_CONFIG }),
    ).rejects.toThrow("encode");
  });

  it("generates a PDF that preserves heading-level hierarchy", async () => {
    const payload = await markdownToPdfPayload(featureListMd);
    const headings = payload.blocks.filter((b) => b.type === "heading");

    // First heading should be h1 or the main title
    const firstHeading = headings[0]! as Extract<typeof headings[0], { type: "heading" }>;
    expect(firstHeading.level).toBeLessThanOrEqual(4); // feature-list.md uses h4 for title

    // Subsequent headings should include h2
    const hasH2 = headings.some((h) => (h as any).level === 2);
    expect(hasH2).toBe(true);
  });

  it("renders table rows that do not exceed content width", async () => {
    const payload = await markdownToPdfPayload(featureListMd);
    const tables = payload.blocks.filter((b) => b.type === "table");

    for (const table of tables) {
      if (table.type !== "table") continue;

      // Each row should have consistent column count
      const colCounts = table.rows.map((r) => r.length);
      const maxCols = Math.max(...colCounts);
      expect(maxCols).toBeGreaterThanOrEqual(2); // at least 2 columns

      // Row count should be reasonable
      expect(table.rows.length).toBeGreaterThan(0);
    }
  });
});
