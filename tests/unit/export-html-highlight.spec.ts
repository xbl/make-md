import { describe, it, expect } from "vitest";
import { markdownToHtml } from "@/lib/export-html";

describe("markdownToHtml highlight", () => {
  it("wraps fenced js with hljs classes", () => {
    const html = markdownToHtml("```js\nconst x = 1\n```", "Test");
    expect(html).toContain('class="hljs');
    expect(html).toContain("language-javascript");
    expect(html).toContain("<style>");
  });

  it("highlights yaml fences with the registered yaml language", () => {
    const html = markdownToHtml("```yml\nname: demo\n```", "Test");
    expect(html).toContain("language-yaml");
    expect(html).toContain("hljs-attr");
  });

  it("resolves local markdown image paths when a document path is available", () => {
    const html = markdownToHtml(
      "![架构图](../概要设计 images/image 3.png)",
      "Test",
      "/Users/blxie/Documents/make-md/docs/specs/设计说明.md",
    );

    expect(html).toContain("<img ");
    expect(html).toContain("file:///Users/blxie/Documents/make-md/docs/");
    expect(html).toContain("image%203.png");
  });

  it("leaves mermaid as pre.mermaid", () => {
    const html = markdownToHtml("```mermaid\ngraph TD\n```", "Test");
    expect(html).toContain('class="mermaid"');
    expect(html).not.toContain('class="hljs language-mermaid"');
  });

  it("does not leak renderer state between consecutive exports", () => {
    const first = markdownToHtml("```mermaid\ngraph TD\n```", "First");
    const second = markdownToHtml("```js\nconst x = 1\n```", "Second");

    expect(first).toContain('class="mermaid"');
    expect(second).toContain("language-javascript");
    expect(second).not.toContain("mermaid.esm.min.mjs");
  });
});
