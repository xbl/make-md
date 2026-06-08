import { defineStore } from "pinia";

export type EditorTheme = "dark" | "light";

function getStorage(): Storage | null {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
}

function loadTheme(): EditorTheme {
  const theme = getStorage()?.getItem("make-md:theme");
  return theme === "dark" || theme === "light" ? theme : "light";
}

export const useUiStore = defineStore("ui", {
  state: () => ({
    commandPaletteOpen: false,
    settingsOpen: false,
    settingsShortcutRecording: false,
    sidebarCollapsed: false,
    focusMode: false,
    findReplaceOpen: false,
    findReplaceMode: "find" as "find" | "replace",
    theme: loadTheme(),
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
      this.settingsShortcutRecording = false;
    },
    toggleSettings() {
      this.settingsOpen = !this.settingsOpen;
      if (!this.settingsOpen) {
        this.settingsShortcutRecording = false;
      }
    },
    startSettingsShortcutRecording() {
      this.settingsShortcutRecording = true;
    },
    stopSettingsShortcutRecording() {
      this.settingsShortcutRecording = false;
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    toggleFocusMode() {
      this.focusMode = !this.focusMode;
    },
    toggleTheme() {
      this.theme = this.theme === "dark" ? "light" : "dark";
      getStorage()?.setItem("make-md:theme", this.theme);
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
