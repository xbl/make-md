import { defineStore } from "pinia";

export type AiProviderId = "openai" | "deepseek";
export type AiPreviewState = {
  mode: "selection" | "document";
  from: number;
  to: number;
  originalText: string;
  previewText: string;
};

export const useAiStore = defineStore("ai", {
  state: () => ({
    settingsOpen: false,
    activeProvider: "deepseek" as AiProviderId,
    providers: {
      openai: { model: "gpt-4o", baseUrl: "" },
      deepseek: { model: "deepseek-chat", baseUrl: "" },
    },
    isGenerating: false,
    preview: null as AiPreviewState | null,
    toolbarMode: "selection" as "selection" | "document",
  }),
  actions: {
    openSettings() {
      this.settingsOpen = true;
    },
    closeSettings() {
      this.settingsOpen = false;
    },
    setPreview(preview: AiPreviewState) {
      this.preview = preview;
    },
    clearPreview() {
      this.preview = null;
    },
  },
});
