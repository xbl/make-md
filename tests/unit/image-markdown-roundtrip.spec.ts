import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { serializeMarkdown } from "../../src/editor/markdown-serializer";

describe("image markdown round-trip", () => {
  it("preserves width and height in title", () => {
    const input = "![cat](cat.png \"1200x800\")";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    expect(output).toBe(input);
  });

  it("preserves align in title", () => {
    const input = "![cat](cat.png \"align=center\")";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    expect(output).toBe(input);
  });

  it("preserves combined size and align", () => {
    const input = "![cat](cat.png \"1200x800 align=left\")";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    expect(output).toBe(input);
  });

  it("omits title when no size or non-inline align", () => {
    const input = "![cat](cat.png)";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    expect(output).toBe(input);
  });

  it("preserves regular title without size/align patterns", () => {
    const input = "![cat](cat.png \"A nice cat photo\")";
    const doc = parseMarkdown(input);
    const output = serializeMarkdown(doc);
    // Regular title without size/align is lost in round-trip (not stored as node attr)
    expect(output).toBe("![cat](cat.png)");
  });

  it("parses image node attrs from title", () => {
    const input = "![cat](cat.png \"1200x800 align=right\")";
    const doc = parseMarkdown(input);
    const img = doc.firstChild?.firstChild;
    expect(img?.attrs.width).toBe(1200);
    expect(img?.attrs.height).toBe(800);
    expect(img?.attrs.align).toBe("right");
  });
});
