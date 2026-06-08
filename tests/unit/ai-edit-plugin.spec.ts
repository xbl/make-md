import { describe, expect, it } from "vitest";
import { createAiPreviewState } from "@/editor/ai-edit/plugin";

describe("ai edit plugin", () => {
  it("stores preview state for a selection rewrite", () => {
    const state = createAiPreviewState({
      mode: "selection",
      from: 5,
      to: 10,
      originalText: "hello",
      previewText: "hi",
    });

    expect(state.previewText).toBe("hi");
    expect(state.originalText).toBe("hello");
  });
});
