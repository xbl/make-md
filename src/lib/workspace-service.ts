import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type TreeNode = {
  name: string;
  path: string;
  kind: "file" | "folder" | string;
  children: TreeNode[];
};

export async function listMarkdownTree(root: string): Promise<TreeNode> {
  if (!isTauri()) {
    return { name: "root", path: root, kind: "folder", children: [] };
  }
  return invoke<TreeNode>("list_markdown_tree", { root });
}

export async function watchFolder(root: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await invoke("watch_folder", { root });
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let unlistenChanged: UnlistenFn | null = null;

export async function startFolderWatch(root: string, refresh: () => Promise<void>) {
  if (!isTauri()) {
    return;
  }

  unlistenChanged?.();
  unlistenChanged = await listen("workspace://changed", () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      void refresh();
    }, 300);
  });

  await watchFolder(root);
}

export function stopFolderWatch() {
  unlistenChanged?.();
  unlistenChanged = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export async function createWorkspaceFile(parent: string, name: string) {
  if (!isTauri()) {
    throw new Error("Desktop app required");
  }
  return invoke<string>("create_file", { parent, name });
}

export async function renameWorkspaceFile(from: string, to: string) {
  if (!isTauri()) {
    throw new Error("Desktop app required");
  }
  return invoke<string>("rename_file", { from, to });
}

export async function deleteWorkspaceFile(path: string) {
  if (!isTauri()) {
    throw new Error("Desktop app required");
  }
  return invoke<void>("delete_file", { path });
}

export async function moveWorkspaceFile(from: string, toDir: string) {
  if (!isTauri()) {
    throw new Error("Desktop app required");
  }
  return invoke<string>("move_file", { from, toDir });
}

export async function revealInFinder(path: string) {
  if (!isTauri()) {
    throw new Error("Desktop app required");
  }
  return invoke<void>("reveal_in_finder", { path });
}
