import { defineStore } from "pinia";

export type EditorTheme = "dark" | "light";

export const useUiStore = defineStore("ui", {
  state: () => ({
    commandPaletteOpen: false,
    sidebarCollapsed: false,
    focusMode: false,
    theme: (localStorage.getItem("make-md:theme") as EditorTheme) || "dark",
  }),
  actions: {
    toggleCommandPalette() {
      this.commandPaletteOpen = !this.commandPaletteOpen;
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
  },
});
