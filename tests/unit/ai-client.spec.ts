import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "enriched content" }),
  stepCountIs: vi.fn().mockReturnValue(() => true),
  tool: vi.fn((def: Record<string, unknown>) => def),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn().mockReturnValue({
    chat: vi.fn().mockReturnValue("mock-model"),
  }),
}));

import { generateResearchText } from "@/lib/ai/client";

describe("ai client", () => {
  it("returns text from generateText", async () => {
    const result = await generateResearchText({
      selection: "hello",
      sectionMarkdown: "# Doc",
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-test",
    });
    expect(typeof result).toBe("string");
  });
});
