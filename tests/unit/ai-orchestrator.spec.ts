import { describe, expect, it } from "vitest";
import { createAiOrchestrator } from "@/lib/ai/orchestrator";

describe("ai orchestrator", () => {
  it("assembles a markdown-only rewrite prompt", async () => {
    const orchestrator = createAiOrchestrator({
      activeProvider: () => ({ provider: "deepseek", model: "deepseek-chat" }),
      startStream: async (request) => ({ requestId: String(request.requestId) }),
    });

    const result = await orchestrator.rewriteSelection({
      instruction: "Polish",
      selection: "hello",
      sectionMarkdown: "# Title\n\nhello",
      fullMarkdown: "# Title\n\nhello",
    });

    expect(result.requestId).toBeTruthy();
  });
});
