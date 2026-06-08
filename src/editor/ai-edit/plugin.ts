export type AiPreviewState = {
  mode: "selection" | "document";
  from: number;
  to: number;
  originalText: string;
  previewText: string;
};

export function createAiPreviewState(input: AiPreviewState): AiPreviewState {
  return input;
}
