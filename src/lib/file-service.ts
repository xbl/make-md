import { invoke, isTauri } from "@tauri-apps/api/core";

export async function readMarkdownFile(path: string) {
  if (!isTauri()) {
    return { path, content: "" };
  }
  const content = await invoke<string>("read_markdown_file", { path });
  return { path, content };
}

export async function writeMarkdownFile(path: string, content: string) {
  if (!isTauri()) {
    return { path, content };
  }
  await invoke("write_markdown_file", { path, content });
  return { path, content };
}

export async function loadRecentFiles() {
  if (!isTauri()) {
    return [];
  }
  return invoke<string[]>("load_recent_files");
}

export async function saveRecentFile(path: string) {
  if (!isTauri()) {
    return [path];
  }
  return invoke<string[]>("save_recent_file", { path });
}
