import { PDFDocument } from "pdf-lib";
import mermaid from "mermaid";
import { marked } from "marked";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { pickSavePdfFile, readBinaryFile, writeBinaryFile } from "@/lib/file-service";
import { resolveMarkdownImageDisplaySrc } from "@/lib/markdown-image-src";
import { resolveMarkdownImagePath } from "@/lib/markdown-image-src";
import { loadPdfFonts } from "./font-loader";
import { PageEngine } from "./page-engine";
import { renderBlocks } from "./renderer";
import type { PfdBlock, PdfExportPayload } from "./renderer";
import { PAGE_CONFIG } from "./types";

// ── Helpers ──

const MARKDOWN_IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
}

function normalizeText(value: string) {
  return stripTags(value).trim();
}

// ── Image resolution ──

let mermaidReady = false;

async function ensureMermaidInitialized() {
  if (mermaidReady) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
  mermaidReady = true;
}

async function svgToPngBytes(svg: string): Promise<Uint8Array> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load SVG"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("canvas toBlob failed"));
    }, "image/png");
  });

  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function renderMermaidPng(code: string): Promise<Uint8Array> {
  await ensureMermaidInitialized();
  const { svg } = await mermaid.render(`mermaid-pdf-${Date.now()}`, code);
  return svgToPngBytes(svg);
}

function isNativeImageFormat(ext: string) {
  return ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
}

function imageFileExtension(src: string) {
  return src.split(".").pop()?.toLowerCase() ?? "";
}

async function resolveImageToPng(src: string, docPath?: string): Promise<Uint8Array | null> {
  try {
    const displaySrc = resolveMarkdownImageDisplaySrc(src, docPath);

    if (displaySrc && isTauri()) {
      const path = resolveMarkdownImagePath(src, docPath);
      if (path) {
        try {
          return await readBinaryFile(path);
        } catch {
          // fall through to fetch
        }
      }
    }

    const response = await fetch(displaySrc || src);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (!isNativeImageFormat(imageFileExtension(displaySrc || src))) {
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("toBlob failed"));
        }, "image/png");
      });
      const ab = await pngBlob.arrayBuffer();
      URL.revokeObjectURL(url);
      return new Uint8Array(ab);
    }

    return bytes;
  } catch {
    return null;
  }
}

// ── Markdown parsing ──

function parseStandaloneMarkdownImage(text: string): { alt: string; src: string } | null {
  const match = text.match(MARKDOWN_IMAGE_RE);
  if (!match) return null;
  return { alt: match[1] ?? "", src: match[2] ?? "" };
}

export async function markdownToPdfPayload(
  markdown: string,
  options?: { title?: string; docPath?: string },
): Promise<PdfExportPayload> {
  const blocks: PfdBlock[] = [];
  const tokens = marked.lexer(markdown);

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        blocks.push({ type: "heading", level: token.depth, text: normalizeText(token.text) });
        break;

      case "paragraph": {
        const standaloneImage =
          parseStandaloneMarkdownImage(token.text) ??
          (Array.isArray(token.tokens) &&
          token.tokens.length === 1 &&
          token.tokens[0]?.type === "image" &&
          typeof token.tokens[0].href === "string"
            ? { alt: token.tokens[0].text ?? "", src: token.tokens[0].href }
            : null);

        if (standaloneImage) {
          const png = await resolveImageToPng(standaloneImage.src, options?.docPath);
          if (png) {
            blocks.push({ type: "image", alt: standaloneImage.alt, png });
            break;
          }
        }
        blocks.push({ type: "paragraph", text: token.text });
        break;
      }

      case "code": {
        const lang = token.lang ?? "";
        if (lang && lang.toLowerCase() === "mermaid") {
          try {
            const png = await renderMermaidPng(token.text);
            blocks.push({ type: "mermaid", code: token.text, png });
            break;
          } catch {
            blocks.push({ type: "code", language: lang, text: token.text });
            break;
          }
        }
        blocks.push({ type: "code", language: lang, text: token.text });
        break;
      }

      case "list": {
        type ListItemish = { text: string; number?: number; tokens?: unknown[]; ordered?: boolean; items?: unknown[] };
        let itemIndex = 0;
        function pushItems(items: ListItemish[], ordered: boolean, level: number) {
          for (const item of items) {
            itemIndex += 1;
            const text = item.tokens
              ?.filter((t: unknown) => {
                const tok = t as { type?: string };
                return tok.type === "text" || tok.type === "paragraph";
              })
              .map((t: unknown) => (t as { text?: string }).text ?? "")
              .join("") ?? item.text;
            blocks.push({ type: "listItem", text: normalizeText(text), ordered, level, number: ordered ? itemIndex : undefined });
            for (const subToken of item.tokens ?? []) {
              const st = subToken as { type?: string; items?: unknown[]; ordered?: boolean };
              if (st.type === "list") {
                pushItems(st.items as ListItemish[], st.ordered ?? false, level + 1);
              }
            }
          }
        }
        pushItems(token.items as ListItemish[], token.ordered, 0);
        break;
      }

      case "table": {
        const headerRowCount = token.header.length;
        const rows: string[][] = [];
        for (const row of [...token.header, ...token.rows]) {
          if (Array.isArray(row)) {
            rows.push(row.map((cell: unknown) => (cell as { text?: string }).text ?? ""));
          } else {
            const tableRow = row as { tokens?: unknown[]; text?: string };
            rows.push((tableRow.tokens ?? []).map((cell: unknown) => (cell as { text?: string }).text ?? ""));
          }
        }
        blocks.push({ type: "table", rows, headerRowCount });
        break;
      }

      case "blockquote":
        blocks.push({ type: "blockquote", text: token.text });
        break;

      default:
        if ("text" in token && typeof token.text === "string" && token.text.trim()) {
          blocks.push({ type: "paragraph", text: token.text });
        }
    }
  }

  const filtered = blocks.filter((b) => {
    if (b.type === "paragraph" || b.type === "heading") return b.text.trim().length > 0;
    if (b.type === "code") return b.text.trim().length > 0;
    return true;
  });

  return { title: options?.title ?? "Document", blocks: filtered };
}

// ── Public API ──

export async function exportMarkdownToPdf(
  markdown: string,
  title: string,
  defaultPath?: string,
  docPath?: string,
): Promise<string | null> {
  const path = await pickSavePdfFile(defaultPath);
  if (!path) {
    return null;
  }
  if (!isTauri()) {
    throw new Error("PDF export requires the desktop app");
  }

  // 1. Parse markdown to blocks (with image/mermaid resolution)
  const payload = await markdownToPdfPayload(markdown, { title, docPath });

  // 2. Create PDF and embed fonts
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadPdfFonts(pdfDoc);

  // 3. Render blocks into pages
  const engine = new PageEngine(pdfDoc, fonts, PAGE_CONFIG);
  await renderBlocks(payload, { engine, fonts, config: PAGE_CONFIG });

  // 4. Serialize and write
  const pdfBytes = await pdfDoc.save();
  await writeBinaryFile(path, Array.from(pdfBytes));

  return path;
}
