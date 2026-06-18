export const AI_PRESETS = [
  {
    id: "research",
    instruction: "Search the web for supplementary information and enrich the selected text.",
  },
  {
    id: "polish",
    instruction: "Improve prose while preserving meaning and Markdown structure.",
  },
  {
    id: "translate-en",
    instruction: "Translate to English and preserve Markdown formatting.",
  },
  {
    id: "translate-zh",
    instruction: "Translate to Chinese and preserve Markdown formatting.",
  },
  {
    id: "expand",
    instruction: "Expand the content without changing core meaning.",
  },
  {
    id: "condense",
    instruction: "Shorten the content while preserving key information.",
  },
] as const;

export type AiPresetId = (typeof AI_PRESETS)[number]["id"];
