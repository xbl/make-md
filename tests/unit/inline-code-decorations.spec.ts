import { describe, it, expect } from "vitest";
import { tokenizeInlineCodeHeuristic } from "@/editor/inline-code-decorations";

describe("tokenizeInlineCodeHeuristic", () => {
  it("classifies string before keyword", () => {
    const tokens = tokenizeInlineCodeHeuristic('"if"');
    expect(tokens[0]).toEqual({ from: 0, to: 4, kind: "string", text: '"if"' });
  });

  it("classifies numbers and keywords", () => {
    const tokens = tokenizeInlineCodeHeuristic("return 42");
    expect(tokens.some((t) => t.kind === "keyword" && t.text === "return")).toBe(true);
    expect(tokens.some((t) => t.kind === "number")).toBe(true);
  });
});
