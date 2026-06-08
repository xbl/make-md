import { describe, expect, it } from "vitest";
import { mergeAgentsContent } from "@/lib/ai/config/agents-loader";

describe("agents loader", () => {
  it("puts project AGENTS.md before global content", () => {
    const merged = mergeAgentsContent("project rules", "global rules");
    expect(merged.startsWith("project rules")).toBe(true);
    expect(merged).toContain("global rules");
  });
});
