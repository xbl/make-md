import { describe, expect, it } from "vitest";
import { scoreSkillMatch } from "@/lib/ai/skill-matcher";

describe("skill matcher", () => {
  it("prefers glob matches over keyword-only matches", () => {
    const score = scoreSkillMatch(
      { name: "docs", description: "api docs", globs: ["docs/**"] },
      { filePath: "docs/a.md", previewText: "api reference" },
    );

    expect(score).toBeGreaterThan(10);
  });
});
