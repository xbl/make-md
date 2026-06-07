import { describe, it, expect } from "vitest";
import { collectCodeBlocksForHighlight } from "@/editor/syntax-highlight/plugin";
import { markdownSchema } from "@/editor/schema";

describe("collectCodeBlocksForHighlight", () => {
  it("skips mermaid blocks", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("code_block", { params: "mermaid" }, [markdownSchema.text("graph TD")]),
      markdownSchema.node("code_block", { params: "js" }, [markdownSchema.text("const x = 1")]),
    ]);
    const blocks = collectCodeBlocksForHighlight(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("javascript");
  });
});
