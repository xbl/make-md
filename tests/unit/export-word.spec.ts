import { beforeEach, describe, expect, it, vi } from "vitest";
import { markdownToWordPayload, wordPayloadToDocxBytes } from "@/lib/export-word";

const mermaidRenderMock = vi.fn(async () => ({
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#fff"/><text x="10" y="30">diagram</text></svg>',
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => mermaidRenderMock(...args),
  },
}));

describe("export word", () => {
  beforeEach(() => {
    mermaidRenderMock.mockReset();
    mermaidRenderMock.mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#fff"/><text x="10" y="30">diagram</text></svg>',
    });

    class FakeImage {
      naturalWidth = 120;
      naturalHeight = 60;
      width = 120;
      height = 60;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: FakeImage,
    });

    vi.stubGlobal("URL", Object.assign(globalThis.URL, {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    }));

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        fillStyle: "",
        fillRect: vi.fn(),
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
  });

  it("exports mermaid as image without source code by default", async () => {
    const payload = await markdownToWordPayload("```mermaid\ngraph TD\nA-->B\n```", { title: "Diagram" });

    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]?.type).toBe("mermaid");
  });

  it("includes mermaid source code only when requested", async () => {
    const payload = await markdownToWordPayload("```mermaid\ngraph TD\nA-->B\n```", {
      includeMermaidCode: true,
      title: "Diagram",
    });

    expect(payload.blocks.map((block) => block.type)).toEqual(["mermaid", "code"]);
    expect(payload.blocks[1]).toMatchObject({
      type: "code",
      language: "mermaid",
      text: "graph TD\nA-->B",
    });
  });

  it("writes png media entries into docx bytes", () => {
    const bytes = wordPayloadToDocxBytes({
      title: "Diagram",
      blocks: [
        { type: "paragraph", text: "hello" },
        { type: "mermaid", code: "graph TD", png: new Uint8Array([137, 80, 78, 71]) },
      ],
    });

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("word/media/image-1.png");
  });

  it("preserves inline markdown styles in exported document xml", () => {
    const bytes = wordPayloadToDocxBytes({
      title: "Styled",
      blocks: [
        {
          type: "paragraph",
          text: "This is **bold** and *italic* and `code`",
        },
      ],
    });

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("<w:b/>");
    expect(text).toContain("<w:i/>");
    expect(text).toContain('w:rFonts w:ascii="Menlo"');
  });

  it("exports markdown images as embedded docx media instead of raw markdown text", async () => {
    const payload = await markdownToWordPayload("![架构图](../概要设计 images/image3.png)", {
      title: "Images",
      docPath: "/Users/blxie/Documents/project/docs/design.md",
    });

    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]?.type).toBe("image");

    const bytes = wordPayloadToDocxBytes(payload);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("word/media/image-1.png");
    expect(text).not.toContain("![架构图](../概要设计 images/image3.png)");
  });

  it("exports markdown tables as word tables with borders", async () => {
    const payload = await markdownToWordPayload("| A | B |\n|---|---|\n| 1 | 2 |", {
      title: "Table",
    });

    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]?.type).toBe("table");

    const bytes = wordPayloadToDocxBytes(payload);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("<w:tbl>");
    expect(text).toContain("<w:tblBorders>");
    expect(text).toContain("<w:t>A</w:t>");
    expect(text).toContain("<w:t>2</w:t>");
  });

  it("falls back to mermaid code block when diagram rendering fails", async () => {
    mermaidRenderMock.mockRejectedValueOnce(new Error("Parse error"));

    const payload = await markdownToWordPayload("```mermaid\nbad diagram\n```", { title: "Diagram" });

    expect(payload.blocks).toEqual([
      {
        type: "code",
        language: "mermaid",
        text: "bad diagram",
      },
    ]);
  });
});
