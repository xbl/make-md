import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  __resetWordExportTauriDetectorForTests,
  __setWordExportTauriDetectorForTests,
  markdownToWordPayload,
  wordPayloadToDocxBytes,
} from "@/lib/export-word";
import * as fileService from "@/lib/file-service";

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
  afterEach(() => {
    __resetWordExportTauriDetectorForTests();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    __setWordExportTauriDetectorForTests(() => false);
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

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type" ? "image/png" : null;
          },
        },
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
        blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
      })),
    );
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

  it("declares numbering.xml in content types so Word can open the package without repair", () => {
    const bytes = wordPayloadToDocxBytes({
      title: "Numbering",
      blocks: [{ type: "paragraph", text: "hello" }],
    });

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain(
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>',
    );
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

  it("exports standalone markdown png images even when marked keeps them as plain paragraph text", async () => {
    const payload = await markdownToWordPayload(
      "![整体高阶架构设计](../概要设计 images/SDSP领域-整体高阶架构设计.png)",
      {
        title: "Images",
        docPath: "/Users/blxie/Documents/项目/上海银行/二期/Markdown 文档/概要设计/SDSP 领域-概要设计.md",
      },
    );

    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]?.type).toBe("image");
  });

  it("embeds local png images without depending on HTMLImage decode success", async () => {
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: FailingImage,
    });
    __setWordExportTauriDetectorForTests(() => true);
    vi.spyOn(fileService, "readBinaryFile").mockResolvedValue(new Uint8Array([137, 80, 78, 71]));

    const payload = await markdownToWordPayload(
      "![整体高阶架构设计](../概要设计 images/SDSP领域-整体高阶架构设计.png)",
      {
        title: "Images",
        docPath: "/Users/blxie/Documents/项目/上海银行/二期/Markdown 文档/概要设计/SDSP 领域-概要设计.md",
      },
    );

    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]?.type).toBe("image");
  });

  it("produces an image docx package that unzip can read without structural errors", async () => {
    const payload = await markdownToWordPayload("![架构图](../概要设计 images/image3.png)", {
      title: "Images",
      docPath: "/Users/blxie/Documents/project/docs/design.md",
    });
    const bytes = wordPayloadToDocxBytes(payload);
    const tempDir = mkdtempSync(join(tmpdir(), "make-md-word-"));
    const docxPath = join(tempDir, "export.docx");

    try {
      writeFileSync(docxPath, Buffer.from(bytes));
      const output = execFileSync("unzip", ["-t", docxPath], { encoding: "utf8" });
      expect(output).toContain("No errors detected");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("diagnoses the real SDSP outline markdown export package", async () => {
    const mdPath = "/Users/blxie/Documents/项目/上海银行/二期/Markdown 文档/概要设计/SDSP 领域-概要设计.md";
    const markdown = readFileSync(mdPath, "utf8");
    const originalFetch = globalThis.fetch;

    vi.stubGlobal("fetch", vi.fn(async (src: string | URL) => {
      const fileUrl = new URL(String(src));
      const bytes = readFileSync(fileUrl);
      return {
        ok: true,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    }));

    const payload = await markdownToWordPayload(markdown, {
      title: "SDSP 领域-概要设计",
      docPath: mdPath,
    });

    const tempDir = mkdtempSync(join(tmpdir(), "make-md-word-real-"));
    const docxPath = join(tempDir, "sdsp-outline.docx");

    try {
      expect(payload.blocks.filter((block) => block.type === "image").length).toBeGreaterThan(3);

      const bytes = wordPayloadToDocxBytes(payload);
      writeFileSync(docxPath, Buffer.from(bytes));

      const unzipOutput = execFileSync("unzip", ["-t", docxPath], { encoding: "utf8" });
      const relsXml = execFileSync("unzip", ["-p", docxPath, "word/_rels/document.xml.rels"], { encoding: "utf8" });
      const documentXml = execFileSync("unzip", ["-p", docxPath, "word/document.xml"], { encoding: "utf8" });
      const mediaList = execFileSync("unzip", ["-Z1", docxPath], { encoding: "utf8" });

      expect(unzipOutput).toContain("No errors detected");
      expect(relsXml).toContain("rIdImage1");
      expect(documentXml).toContain("r:embed=\"rIdImage1\"");
      expect(mediaList).toContain("word/media/image-1.png");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      vi.stubGlobal("fetch", originalFetch);
    }
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

  it("exports markdown lists as native word numbering instead of markdown prefixes", async () => {
    const payload = await markdownToWordPayload("1. First\n2. Second\n\n- Bullet", {
      title: "List",
    });

    expect(payload.blocks.map((block) => block.type)).toEqual(["listItem", "listItem", "listItem"]);

    const bytes = wordPayloadToDocxBytes(payload);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("word/numbering.xml");
    expect(text).toContain("<w:numPr>");
    expect(text).not.toContain("<w:t>1. First</w:t>");
    expect(text).not.toContain("<w:t>- Bullet</w:t>");
  });

  it("exports blockquotes as styled quote paragraphs instead of markdown markers", async () => {
    const payload = await markdownToWordPayload("> quoted text", {
      title: "Quote",
    });

    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]?.type).toBe("blockquote");

    const bytes = wordPayloadToDocxBytes(payload);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('<w:ind w:left="720"/>');
    expect(text).toContain('<w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>');
    expect(text).not.toContain("<w:t>&gt; quoted text</w:t>");
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
