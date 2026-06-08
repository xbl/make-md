import { describe, expect, it } from "vitest";
import { AI_PRESETS } from "@/lib/ai/presets";

describe("ai presets", () => {
  it("defines the built-in rewrite presets", () => {
    expect(AI_PRESETS.map((preset) => preset.id)).toEqual([
      "polish",
      "translate-en",
      "translate-zh",
      "expand",
      "condense",
    ]);
  });
});
