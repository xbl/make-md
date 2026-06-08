export const AI_PRESETS = [
  {
    id: "polish",
    label: "Polish",
    instruction: "Improve prose while preserving meaning and Markdown structure.",
  },
  {
    id: "translate-en",
    label: "Translate to English",
    instruction: "Translate to English and preserve Markdown formatting.",
  },
  {
    id: "translate-zh",
    label: "Translate to Chinese",
    instruction: "Translate to Chinese and preserve Markdown formatting.",
  },
  {
    id: "expand",
    label: "Expand",
    instruction: "Expand the content without changing core meaning.",
  },
  {
    id: "condense",
    label: "Condense",
    instruction: "Shorten the content while preserving key information.",
  },
] as const;
