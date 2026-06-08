type AiRewriteSelectionInput = {
  instruction: string;
  selection: string;
  sectionMarkdown: string;
  fullMarkdown: string;
  agentsContent?: string;
  matchedSkills?: Array<{ body: string }>;
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
  function buildSystemPrompt(input: AiRewriteSelectionInput) {
    const sections = [
      input.agentsContent?.trim(),
      ...(input.matchedSkills ?? []).map((skill) => skill.body.trim()),
      "You are a Markdown editing assistant. Output only the modified Markdown text. Preserve formatting.",
    ].filter(Boolean);

    return sections.join("\n\n");
  }

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
            content: buildSystemPrompt(input),
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
