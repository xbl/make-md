import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { normalizeFilePath } from "@/lib/file-path";

const MARKDOWN_FILTER = [{ name: "Markdown", extensions: ["md", "markdown"] }];
const HTML_FILTER = [{ name: "HTML", extensions: ["html", "htm"] }];
const PDF_FILTER = [{ name: "PDF", extensions: ["pdf"] }];
const WORD_FILTER = [{ name: "Word", extensions: ["docx"] }];

function getE2eBridge() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__MAKE_MD_E2E__ ?? null;
}

export async function readMarkdownFile(path: string) {
  if (!isTauri()) {
    return { path, content: getE2eBridge()?.files[path] ?? "" };
  }
  const content = await invoke<string>("read_markdown_file", { path });
  return { path, content };
}

export async function writeMarkdownFile(path: string, content: string) {
  if (!isTauri()) {
    const bridge = getE2eBridge();
    if (bridge) {
      bridge.files[path] = content;
    }
    return { path, content };
  }
  await invoke("write_markdown_file", { path, content });
  return { path, content };
}

export async function writeTextFile(path: string, content: string) {
  return writeMarkdownFile(path, content);
}

export async function writeBinaryFile(path: string, bytes: number[]) {
  if (!isTauri()) {
    return { path, bytes };
  }
  await invoke("write_binary_file", { path, bytes });
  return { path, bytes };
}

export async function readBinaryFile(path: string) {
  if (!isTauri()) {
    return new Uint8Array([]);
  }
  const bytes = await invoke<number[]>("read_binary_file", { path });
  return new Uint8Array(bytes);
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

export async function removeRecentFile(path: string) {
  if (!isTauri()) {
    return [];
  }
  return invoke<string[]>("remove_recent_file", { path });
}

export async function clearRecentFiles() {
  if (!isTauri()) {
    return [];
  }
  return invoke<string[]>("clear_recent_files");
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

export async function pickSavePdfFile(defaultPath?: string): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  const selected = await save({
    filters: PDF_FILTER,
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

export type SaveWordSelection = {
  path: string;
  includeMermaidCode: boolean;
};

export async function pickSaveWordFile(defaultPath?: string): Promise<SaveWordSelection | null> {
  if (!isTauri()) {
    return null;
  }
  const selected = await invoke<SaveWordSelection | null>("pick_save_word_file", { defaultPath });
  if (!selected) {
    return null;
  }
  return {
    path: normalizeFilePath(selected.path),
    includeMermaidCode: selected.includeMermaidCode,
  };
}

export function getWordSaveFilters() {
  return WORD_FILTER;
}
