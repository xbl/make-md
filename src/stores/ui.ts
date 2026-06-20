import { defineStore } from "pinia";

export type EditorTheme = "dark" | "light";
export type SettingsSection = "general" | "shortcuts" | "ai";

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
    activeSettingsSection: "general" as SettingsSection,
    settingsShortcutRecording: false,
    sidebarCollapsed: true,
    focusMode: false,
    sourceMode: false,
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
    openSettings(section?: SettingsSection) {
      if (section) {
        this.activeSettingsSection = section;
      }
      this.settingsOpen = true;
    },
    setActiveSettingsSection(section: SettingsSection) {
      this.activeSettingsSection = section;
    },
    closeSettings() {
      this.settingsOpen = false;
      this.settingsShortcutRecording = false;
    },
    toggleSettings(section?: SettingsSection) {
      this.settingsOpen = !this.settingsOpen;
      if (this.settingsOpen && section) {
        this.activeSettingsSection = section;
      }
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
    toggleSourceMode() {
      this.sourceMode = !this.sourceMode;
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
