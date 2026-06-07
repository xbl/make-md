import { invoke, isTauri } from "@tauri-apps/api/core";
import { markdownToHtml } from "@/lib/export-html";
import { pickSavePdfFile } from "@/lib/file-service";

export async function exportMarkdownToPdf(markdown: string, title: string, defaultPath?: string) {
  const html = markdownToHtml(markdown, title);
  const path = await pickSavePdfFile(defaultPath);
  if (!path) {
    return null;
  }
  if (!isTauri()) {
    throw new Error("PDF export requires the desktop app");
  }
  await invoke("export_pdf", { html, outputPath: path });
  return path;
}
