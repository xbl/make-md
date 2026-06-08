type AiRewriteSelectionInput = {
  instruction: string;
  selection: string;
  sectionMarkdown: string;
  fullMarkdown: string;
};

type AiProviderConfig = {
  provider: string;
  model: string;
};

type StartStreamResult = {
  requestId: string;
};

export function createAiOrchestrator(deps: {
  activeProvider: () => AiProviderConfig;
  startStream: (request: Record<string, unknown>) => Promise<StartStreamResult>;
}) {
  return {
    async rewriteSelection(input: AiRewriteSelectionInput) {
      const provider = deps.activeProvider();
      const requestId = globalThis.crypto?.randomUUID?.() ?? `ai-${Date.now()}`;

      return deps.startStream({
        requestId,
        provider: provider.provider,
        model: provider.model,
        messages: [
          {
            role: "system",
            content:
              "You are a Markdown editing assistant. Output only the modified Markdown text. Preserve formatting.",
          },
          {
            role: "user",
            content: `${input.sectionMarkdown}\n---\nModify the following selected text:\n> ${input.selection}\nInstruction: ${input.instruction}`,
          },
        ],
      });
    },
  };
}
