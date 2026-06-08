import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { serializeMarkdown } from "../../src/editor/markdown-serializer";
import { tokenizeInline, paragraphFromMarkdown } from "../../src/editor/inline-parser";
import { markdownSchema } from "../../src/editor/schema";

describe("inline marks", () => {
  it("tokenizes inline marks in a sentence", () => {
    const tokens = tokenizeInline("Text with **bold** and *italic*.");
    expect(tokens.some((token) => token.type === "strong")).toBe(true);
    expect(tokens.some((token) => token.type === "em")).toBe(true);
  });

  it("applies strong marks to text nodes", () => {
    const marked = markdownSchema
      .text("bold")
      .mark(markdownSchema.marks.strong.create().addToSet([]));
    expect(marked.marks.length).toBe(1);
  });

  it("builds marked paragraphs", () => {
    const paragraph = paragraphFromMarkdown("**bold**");
    let hasStrong = false;
    paragraph.forEach((node) => {
      if (node.isText && markdownSchema.marks.strong.isInSet(node.marks)) {
        hasStrong = true;
      }
    });
    expect(hasStrong).toBe(true);
    expect(markdownSchema.marks.strong).toBeTruthy();
  });

  it("round-trips bold and italic", () => {
    const source = "Text with **bold** and *italic*.";
    const doc = parseMarkdown(source);
    const paragraph = doc.child(0);
    let hasStrong = false;
    paragraph.forEach((node) => {
      if (node.isText && markdownSchema.marks.strong.isInSet(node.marks)) {
        hasStrong = true;
      }
    });
    expect(hasStrong).toBe(true);
    const output = serializeMarkdown(doc);
    expect(output).toContain("**bold**");
    expect(output).toContain("*italic*");
  });

  it("round-trips mermaid fences", () => {
    const source = "```mermaid\ngraph TD\n  A-->B\n```";
    const output = serializeMarkdown(parseMarkdown(source));
    expect(output).toContain("```mermaid");
  });

  it("round-trips links and strikethrough", () => {
    const source = "Visit [site](https://example.com) and ~~removed~~.";
    const doc = parseMarkdown(source);
    const output = serializeMarkdown(doc);
    expect(output).toContain("[site](https://example.com)");
    expect(output).toContain("~~removed~~");
  });

  it("parses and serializes inline br tags as hard breaks", () => {
    const source = "alpha<br>beta<br/>gamma";
    const doc = parseMarkdown(source);
    const output = serializeMarkdown(doc);

    expect(output).toContain("alpha<br>beta<br>gamma");
  });
});
