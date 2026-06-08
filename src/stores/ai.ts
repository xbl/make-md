import { defineStore } from "pinia";

export type AiProviderId = "openai" | "deepseek";

export const useAiStore = defineStore("ai", {
  state: () => ({
    settingsOpen: false,
    activeProvider: "deepseek" as AiProviderId,
    providers: {
      openai: { model: "gpt-4o", baseUrl: "" },
      deepseek: { model: "deepseek-chat", baseUrl: "" },
    },
    isGenerating: false,
  }),
  actions: {
    openSettings() {
      this.settingsOpen = true;
    },
    closeSettings() {
      this.settingsOpen = false;
    },
  },
});
