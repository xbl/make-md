import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { serializeMarkdown } from "../../src/editor/markdown-serializer";
import { markdownToHtml } from "../../src/lib/export-html";
import { markdownSchema } from "../../src/editor/schema";

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

  it("preserves a single blank paragraph between blocks", () => {
    const source = "alpha\n\nbeta";
    const output = serializeMarkdown(parseMarkdown(source));

    expect(output).toBe(source);
  });

  it("round-trips an empty paragraph created in the editor", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("paragraph", null, [markdownSchema.text("alpha")]),
      markdownSchema.node("paragraph"),
      markdownSchema.node("paragraph", null, [markdownSchema.text("beta")]),
    ]);

    const output = serializeMarkdown(doc);
    const reparsed = parseMarkdown(output);

    expect(output).toBe("alpha\n\n\n\nbeta");
    expect(reparsed.childCount).toBe(3);
    expect(reparsed.child(1)?.type.name).toBe("paragraph");
    expect(reparsed.child(1)?.textContent).toBe("");
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

  it("preserves already-encoded markdown image path segments", () => {
    const doc = parseMarkdown(
      "![关键数据表设计](../概要设计%20images/SDSP领域-关键数据表设计.png)",
      "/Users/blxie/Documents/项目/上海银行/二期/Markdown 文档/概要设计/SDSP 领域-概要设计.md",
    );

    const image = doc.firstChild?.firstChild;
    expect(image?.type.name).toBe("image");
    expect(image?.attrs.displaySrc).toBe(
      "file:///Users/blxie/Documents/%E9%A1%B9%E7%9B%AE/%E4%B8%8A%E6%B5%B7%E9%93%B6%E8%A1%8C/%E4%BA%8C%E6%9C%9F/Markdown%20%E6%96%87%E6%A1%A3/%E6%A6%82%E8%A6%81%E8%AE%BE%E8%AE%A1%20images/SDSP%E9%A2%86%E5%9F%9F-%E5%85%B3%E9%94%AE%E6%95%B0%E6%8D%AE%E8%A1%A8%E8%AE%BE%E8%AE%A1.png",
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
