import { defineStore } from "pinia";

export const useUiStore = defineStore("ui", {
  state: () => ({
    commandPaletteOpen: false,
    sidebarCollapsed: false,
  }),
  actions: {
    toggleCommandPalette() {
      this.commandPaletteOpen = !this.commandPaletteOpen;
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
  },
});
