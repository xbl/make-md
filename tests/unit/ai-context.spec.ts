import { describe, expect, it } from "vitest";
import { markdownSchema } from "@/editor/schema";
import { buildFullDocumentRewriteContext, buildSelectionRewriteContext } from "@/lib/ai/context";

describe("ai context", () => {
  it("extracts selection and current section", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("heading", { level: 1 }, [markdownSchema.text("Title")]),
      markdownSchema.node("paragraph", null, [markdownSchema.text("Alpha Beta Gamma")]),
    ]);

    const result = buildSelectionRewriteContext(doc, 14, 18);

    expect(result.selection).toBe("Beta");
    expect(result.sectionMarkdown).toContain("# Title");
    expect(result.fullMarkdown).toContain("Alpha Beta Gamma");
  });

  it("marks content as truncated when estimated tokens exceed budget", () => {
    const result = buildFullDocumentRewriteContext("# A\n\n" + "x".repeat(10000), 1000);

    expect(result.truncated).toBe(true);
    expect(result.fullMarkdown).toContain("[content truncated]");
  });
});
