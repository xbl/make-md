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

  it("leaves mermaid as pre.mermaid", () => {
    const html = markdownToHtml("```mermaid\ngraph TD\n```", "Test");
    expect(html).toContain('class="mermaid"');
    expect(html).not.toContain('class="hljs language-mermaid"');
  });
});
