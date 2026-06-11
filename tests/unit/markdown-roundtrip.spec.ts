import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { serializeMarkdown } from "../../src/editor/markdown-serializer";
import { markdownToHtml } from "../../src/lib/export-html";

describe("markdown round trip", () => {
  it("preserves headings, lists, and code blocks", () => {
    const source = "# Title\n\n- a\n- b\n\n```ts\nconst n = 1;\n```";
    const doc = parseMarkdown(source);

    expect(serializeMarkdown(doc)).toContain("# Title");
    expect(serializeMarkdown(doc)).toContain("- a");
    expect(serializeMarkdown(doc)).toContain("const n = 1;");
  });

  it("preserves blockquotes and ordered lists", () => {
    const source = "> quoted\n\n1. first\n2. second";
    const doc = parseMarkdown(source);
    const output = serializeMarkdown(doc);

    expect(output).toContain("> quoted");
    expect(output).toContain("1. first");
    expect(output).toContain("2. second");
  });

  it("preserves task lists, tables, inline marks, and mermaid fences", () => {
    const source = [
      "- [ ] todo",
      "- [x] done",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "Text with **bold** and *italic*.",
      "",
      "```mermaid",
      "graph TD",
      "  A-->B",
      "```",
    ].join("\n");

    const output = serializeMarkdown(parseMarkdown(source));

    expect(output).toContain("- [ ] todo");
    expect(output).toContain("- [x] done");
    expect(output).toContain("| Name | Value |");
    expect(output).toContain("**bold**");
    expect(output).toContain("*italic*");
    expect(output).toContain("```mermaid");
    expect(output).toContain("A-->B");
  });

  it("parses markdown hard breaks from two trailing spaces and normalizes them to br tags", () => {
    const source = "alpha  \nbeta";
    const output = serializeMarkdown(parseMarkdown(source));

    expect(output).toContain("alpha<br>beta");
  });

  it("resolves markdown image display paths with spaces and chinese characters", () => {
    const doc = parseMarkdown(
      "![架构图](../概要设计 images/image 3.png)",
      "/Users/blxie/Documents/make-md/docs/specs/设计说明.md",
    );

    const image = doc.firstChild?.firstChild;
    expect(image?.type.name).toBe("image");
    expect(image?.attrs.src).toBe("../概要设计 images/image 3.png");
    expect(image?.attrs.displaySrc).toBe(
      "file:///Users/blxie/Documents/make-md/docs/%E6%A6%82%E8%A6%81%E8%AE%BE%E8%AE%A1%20images/image%203.png",
    );
  });
});

describe("export html", () => {
  it("embeds mermaid blocks for standalone html export", () => {
    const html = markdownToHtml("```mermaid\ngraph TD\n  A-->B\n```", "Diagram");
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain("graph TD");
    expect(html).toContain("mermaid.esm.min.mjs");
  });
});
