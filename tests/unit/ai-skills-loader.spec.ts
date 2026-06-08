import { describe, expect, it } from "vitest";
import { parseSkillDocument } from "@/lib/ai/config/skills-loader";

describe("skills loader", () => {
  it("parses frontmatter and body from a skill document", () => {
    const parsed = parseSkillDocument(`---
name: docs
description: api docs
globs: docs/**,*.md
---

# Rules
Be precise.`);

    expect(parsed.name).toBe("docs");
    expect(parsed.description).toBe("api docs");
    expect(parsed.globs).toEqual(["docs/**", "*.md"]);
    expect(parsed.body).toContain("Be precise.");
  });
});
