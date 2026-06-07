import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { normalizeFilePath } from "@/lib/file-path";

const MARKDOWN_FILTER = [{ name: "Markdown", extensions: ["md", "markdown"] }];
const HTML_FILTER = [{ name: "HTML", extensions: ["html", "htm"] }];

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

export async function writeTextFile(path: string, content: string) {
  return writeMarkdownFile(path, content);
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

export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  const selected = await open({
    directory: true,
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) {
    return null;
  }
  return normalizeFilePath(selected);
}

export async function pickMarkdownFile(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  const selected = await open({
    multiple: false,
    directory: false,
    filters: MARKDOWN_FILTER,
  });
  if (!selected || Array.isArray(selected)) {
    return null;
  }
  return normalizeFilePath(selected);
}

export async function pickSaveMarkdownFile(defaultPath?: string): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  const selected = await save({
    filters: MARKDOWN_FILTER,
    defaultPath,
  });
  if (!selected) {
    return null;
  }
  return normalizeFilePath(selected);
}

export async function pickSaveHtmlFile(defaultPath?: string): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  const selected = await save({
    filters: HTML_FILTER,
    defaultPath,
  });
  if (!selected) {
    return null;
  }
  return normalizeFilePath(selected);
}
