import { generateText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { webSearch, webFetch } from "@/lib/ai/tools";

export async function generateResearchText(input: {
  selection: string;
  sectionMarkdown: string;
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey: string;
}): Promise<string> {
  const provider = createOpenAI({
    apiKey: input.apiKey,
    baseURL: input.baseUrl || undefined,
  });

  const { text } = await generateText({
    model: provider.chat(input.model),
    stopWhen: stepCountIs(5),
    tools: { webSearch, webFetch },
    system:
      "You are a Markdown research assistant. When asked to enrich a text selection, " +
      "search the web for relevant supplementary information, then return the ORIGINAL " +
      "text with your additions seamlessly integrated. Preserve Markdown formatting. " +
      "Output ONLY the final Markdown text — no explanations, no prefixes.",
    prompt: [
      "Document context:",
      "```markdown",
      input.sectionMarkdown,
      "```",
      "",
      "Selected text to enrich:",
      `> ${input.selection}`,
      "",
      "Search the web for supplementary information related to this selection, " +
        "then return the enriched version. Integrate new facts, data, or context naturally.",
    ].join("\n"),
  });

  return text;
}
