import { defineStore } from "pinia";

export type EditorTheme = "dark" | "light";

export const useUiStore = defineStore("ui", {
  state: () => ({
    commandPaletteOpen: false,
    settingsOpen: false,
    sidebarCollapsed: false,
    focusMode: false,
    findReplaceOpen: false,
    findReplaceMode: "find" as "find" | "replace",
    theme: (localStorage.getItem("make-md:theme") as EditorTheme) || "light",
  }),
  actions: {
    toggleCommandPalette() {
      this.commandPaletteOpen = !this.commandPaletteOpen;
    },
    openCommandPalette() {
      this.commandPaletteOpen = true;
    },
    closeCommandPalette() {
      this.commandPaletteOpen = false;
    },
    openSettings() {
      this.settingsOpen = true;
    },
    closeSettings() {
      this.settingsOpen = false;
    },
    toggleSettings() {
      this.settingsOpen = !this.settingsOpen;
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    toggleFocusMode() {
      this.focusMode = !this.focusMode;
    },
    toggleTheme() {
      this.theme = this.theme === "dark" ? "light" : "dark";
      localStorage.setItem("make-md:theme", this.theme);
      document.documentElement.dataset.theme = this.theme;
    },
    applyTheme() {
      document.documentElement.dataset.theme = this.theme;
    },
    openFindReplace(mode: "find" | "replace" = "find") {
      this.findReplaceMode = mode;
      this.findReplaceOpen = true;
    },
    closeFindReplace() {
      this.findReplaceOpen = false;
    },
  },
});
