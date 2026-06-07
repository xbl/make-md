import { invoke, isTauri } from "@tauri-apps/api/core";

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
