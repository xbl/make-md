import { defineStore } from "pinia";
import { listMarkdownTree, startFolderWatch, stopFolderWatch, type TreeNode } from "@/lib/workspace-service";

export type SidebarTab = "files" | "outline";

export const useFolderWorkspaceStore = defineStore("folder-workspace", {
  state: () => ({
    rootPath: "" as string,
    tree: null as TreeNode | null,
    expandedPaths: [] as string[],
    selectedPath: "" as string,
    activeTab: "files" as SidebarTab,
  }),
  getters: {
    hasFolder(state): boolean {
      return Boolean(state.rootPath);
    },
  },
  actions: {
    isExpanded(path: string) {
      return this.expandedPaths.includes(path);
    },
    toggleExpanded(path: string) {
      if (this.isExpanded(path)) {
        this.expandedPaths = this.expandedPaths.filter((item) => item !== path);
      } else {
        this.expandedPaths = [...this.expandedPaths, path];
      }
    },
    findNode(path: string, node?: TreeNode | null): TreeNode | null {
      const currentNode = node ?? this.tree;
      if (!currentNode) {
        return null;
      }
      if (currentNode.path === path) {
        return currentNode;
      }
      for (const child of currentNode.children) {
        const found = this.findNode(path, child);
        if (found) {
          return found;
        }
      }
      return null;
    },
    async setRootPath(root: string) {
      stopFolderWatch();
      this.rootPath = root;
      this.expandedPaths = [root];
      await this.refreshTree();
      await startFolderWatch(root, async () => {
        await this.refreshTree();
      });
    },
    async refreshTree() {
      if (!this.rootPath) {
        this.tree = null;
        return;
      }
      this.tree = await listMarkdownTree(this.rootPath);
    },
    setActiveTab(tab: SidebarTab) {
      this.activeTab = tab;
    },
    setSelectedPath(path: string) {
      this.selectedPath = path;
    },
  },
});
