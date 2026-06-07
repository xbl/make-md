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
});

describe("export html", () => {
  it("embeds mermaid blocks for standalone html export", () => {
    const html = markdownToHtml("```mermaid\ngraph TD\n  A-->B\n```", "Diagram");
    expect(html).toContain('<pre class="mermaid">');
    expect(html).toContain("graph TD");
    expect(html).toContain("mermaid.esm.min.mjs");
  });
});
