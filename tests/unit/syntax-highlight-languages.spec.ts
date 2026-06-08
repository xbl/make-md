import { describe, it, expect } from "vitest";
import { resolveHighlightLanguage, isMermaidLanguage, highlightCode } from "@/editor/syntax-highlight/languages";

describe("resolveHighlightLanguage", () => {
  it("maps common aliases", () => {
    expect(resolveHighlightLanguage("ts")).toBe("typescript");
    expect(resolveHighlightLanguage("js")).toBe("javascript");
    expect(resolveHighlightLanguage("py")).toBe("python");
  });

  it("falls back to plaintext for unknown", () => {
    expect(resolveHighlightLanguage("not-a-lang")).toBe("plaintext");
  });

  it("excludes mermaid", () => {
    expect(isMermaidLanguage("mermaid")).toBe(true);
    expect(isMermaidLanguage("Mermaid")).toBe(true);
  });

  it("highlights common code without an explicit language using auto-detection", () => {
    const html = highlightCode("const answer = 42;", "");
    expect(html).toContain("hljs-");
  });
});
