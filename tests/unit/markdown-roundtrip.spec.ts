import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { serializeMarkdown } from "../../src/editor/markdown-serializer";

describe("markdown round trip", () => {
  it("preserves headings, lists, and code blocks", () => {
    const source = "# Title\n\n- a\n- b\n\n```ts\nconst n = 1;\n```";
    const doc = parseMarkdown(source);

    expect(serializeMarkdown(doc)).toContain("# Title");
    expect(serializeMarkdown(doc)).toContain("- a");
    expect(serializeMarkdown(doc)).toContain("const n = 1;");
  });
});
