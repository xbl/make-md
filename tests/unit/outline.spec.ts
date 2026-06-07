import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { extractOutline } from "../../src/lib/outline";

describe("outline extraction", () => {
  it("extracts nested headings with positions", () => {
    const doc = parseMarkdown("# One\n\n## Two\n\npara\n\n# Three");
    const items = extractOutline(doc);
    expect(items.map((item) => item.text)).toEqual(["One", "Two", "Three"]);
    expect(items[1]?.level).toBe(2);
    expect(items.every((item) => typeof item.pos === "number")).toBe(true);
  });
});
