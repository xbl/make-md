import { defineStore } from "pinia";
import { loadRecentFiles } from "@/lib/file-service";

export type WorkspaceItem = {
  id: string;
  name: string;
  path: string;
  dirty: boolean;
};

export const useWorkspaceStore = defineStore("workspace", {
  state: () => ({
    items: [] as WorkspaceItem[],
    activeItemId: "",
  }),
  getters: {
    activeItem(state): WorkspaceItem | undefined {
      return state.items.find((item) => item.id === state.activeItemId);
    },
  },
  actions: {
    async hydrateRecentItems() {
      const recent = await loadRecentFiles();
      this.items = recent.map((path, index) => ({
        id: `${index}-${path}`,
        name: path.split("/").pop() ?? path,
        path,
        dirty: false,
      }));
      this.activeItemId = this.items[0]?.id ?? "";
    },
    setActiveItem(id: string) {
      this.activeItemId = id;
    },
  },
});
