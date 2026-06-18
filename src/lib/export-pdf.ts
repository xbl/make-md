import mermaid from "mermaid";
import { marked } from "marked";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { pickSavePdfFile, readBinaryFile } from "@/lib/file-service";
import { resolveMarkdownImageDisplaySrc } from "@/lib/markdown-image-src";
import { resolveMarkdownImagePath } from "@/lib/markdown-image-src";
import { highlightCode, resolveHighlightLanguage } from "@/editor/syntax-highlight/languages";
import highlightStyles from "highlight.js/styles/github.min.css?inline";

// ── Types (shared shape with export-word.ts, inlined to keep modules independent) ──

type PfdBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "listItem"; text: string; ordered: boolean; level: number; number?: number }
  | { type: "blockquote"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "mermaid"; code: string; png: Uint8Array }
  | { type: "image"; alt: string; png: Uint8Array }
  | { type: "table"; rows: string[][]; headerRowCount: number };

type PdfExportPayload = {
  title: string;
  blocks: PfdBlock[];
};

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

function imageToDataUri(png: Uint8Array): string {
  const binary = Array.from(png, (byte) => String.fromCharCode(byte)).join("");
  return `data:image/png;base64,${btoa(binary)}`;
}

// ── Image resolution (mirrors export-word.ts logic) ──

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

// ── Markdown parsing (mirrors markdownToWordPayload) ──

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
        // flatten nested list items
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
        // Only top-level paragraph text in blockquote (same as Word export)
        blocks.push({ type: "blockquote", text: token.text });
        break;

      default:
        if ("text" in token && typeof token.text === "string" && token.text.trim()) {
          blocks.push({ type: "paragraph", text: token.text });
        }
    }
  }

  // Filter empty blocks
  const filtered = blocks.filter((b) => {
    if (b.type === "paragraph" || b.type === "heading") return b.text.trim().length > 0;
    if (b.type === "code") return b.text.trim().length > 0;
    return true;
  });

  return { title: options?.title ?? "Document", blocks: filtered };
}

// ── Inline formatting to HTML ──

type MInlineToken = {
  type: string;
  text?: string;
  raw?: string;
  tokens?: MInlineToken[];
};

function inlineTokensToHtml(tokens: MInlineToken[]): string {
  return tokens.map((t) => inlineTokenToHtml(t)).join("");
}

function inlineTokenToHtml(token: MInlineToken): string {
  switch (token.type) {
    case "strong":
      return `<strong>${inlineTokensToHtml(token.tokens ?? [])}</strong>`;
    case "em":
      return `<em>${inlineTokensToHtml(token.tokens ?? [])}</em>`;
    case "del":
      return `<del>${inlineTokensToHtml(token.tokens ?? [])}</del>`;
    case "codespan":
      return `<code>${escapeHtml(token.text ?? "")}</code>`;
    case "link":
      return inlineTokensToHtml(token.tokens ?? []);
    case "br":
      return "<br />";
    case "html":
      return escapeHtml(stripTags(token.raw ?? token.text ?? ""));
    case "text":
    case "escape":
      return escapeHtml(token.text ?? "");
    default:
      if (Array.isArray(token.tokens) && token.tokens.length > 0) {
        return inlineTokensToHtml(token.tokens);
      }
      return escapeHtml(token.text ?? "");
  }
}

function richParagraphHtml(text: string): string {
  const tokens = marked.Lexer.lexInline(text) as MInlineToken[];
  return inlineTokensToHtml(tokens);
}

// ── HTML generation from blocks ──

function buildPdfHtml(payload: PdfExportPayload): string {
  const parts: string[] = [];
  const blocks = payload.blocks;
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i]!;

    // Group consecutive list items
    if (block.type === "listItem") {
      let listTag = block.ordered ? "ol" : "ul";
      let listHtml = "";
      while (i < blocks.length && blocks[i]!.type === "listItem") {
        const li = blocks[i]! as Extract<PfdBlock, { type: "listItem" }>;
        // Switch tag if orderedness changes
        const tag = li.ordered ? "ol" : "ul";
        if (tag !== listTag) {
          parts.push(`<${listTag}>${listHtml}</${listTag}>`);
          listTag = tag;
          listHtml = "";
        }
        listHtml += `<li>${richParagraphHtml(li.text)}</li>`;
        i += 1;
      }
      parts.push(`<${listTag}>${listHtml}</${listTag}>`);
      continue;
    }

    switch (block.type) {
      case "heading": {
        const hLevel = Math.min(block.level, 6);
        parts.push(`<h${hLevel}>${richParagraphHtml(block.text)}</h${hLevel}>`);
        break;
      }
      case "paragraph":
        parts.push(`<p>${richParagraphHtml(block.text)}</p>`);
        break;
      case "blockquote":
        parts.push(`<blockquote><p>${richParagraphHtml(block.text)}</p></blockquote>`);
        break;
      case "code": {
        const lang = resolveHighlightLanguage(block.language);
        const highlighted = highlightCode(block.text, lang);
        parts.push(`<pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>`);
        break;
      }
      case "image":
        parts.push(`<figure><img src="${imageToDataUri(block.png)}" alt="${escapeHtml(block.alt)}" /></figure>`);
        break;
      case "mermaid":
        parts.push(`<figure class="mermaid-figure"><img src="${imageToDataUri(block.png)}" alt="Mermaid diagram" /></figure>`);
        break;
      case "table": {
        const rowsHtml = block.rows.map((row, ri) => {
          const tag = ri < block.headerRowCount ? "th" : "td";
          const cells = row.map((cell) => `<${tag}>${richParagraphHtml(cell)}</${tag}>`).join("");
          return `<tr>${cells}</tr>`;
        }).join("\n");
        parts.push(`<table><thead>${rowsHtml.split("</tr>")[0]}</tr></thead><tbody>${rowsHtml.split("</tr>").slice(1).join("</tr>")}</tbody></table>`);
        break;
      }
    }
    i += 1;
  }

  const body = parts.join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(payload.title)}</title>
  <style>
    @page {
      size: letter;
      margin: 1in 1in 1in 1in;
    }

    :root {
      --text: #1c1c1a;
      --text-secondary: #5c5c57;
      --border: #e4e2dc;
      --code-bg: #f0efea;
      --code-text: #3d3d38;
      --accent: #2c5282;
      --quote-border: #c4bdb0;
      --quote-text: #5a5a54;
    }

    body {
      font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif;
      font-size: 11pt;
      line-height: 1.78;
      color: var(--text);
      max-width: none;
      margin: 0;
      padding: 0;
    }

    h1 { font-size: 2em; font-weight: 700; margin: 1.2em 0 0.4em; }
    h2 { font-size: 1.5em; font-weight: 700; margin: 1.1em 0 0.3em; }
    h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.25em; }
    h4 { font-size: 1.1em; font-weight: 600; margin: 0.9em 0 0.2em; }
    h5 { font-size: 1em; font-weight: 600; margin: 0.8em 0 0.15em; }
    h6 { font-size: 0.95em; font-weight: 600; color: var(--text-secondary); margin: 0.7em 0 0.1em; }

    h1:first-child,
    h2:first-child,
    h3:first-child {
      margin-top: 0;
    }

    p { margin: 0.5em 0; }

    strong { font-weight: 600; }
    em { font-style: italic; }

    code {
      font-family: "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace;
      font-size: 0.9em;
      background: var(--code-bg);
      padding: 1px 4px;
      border-radius: 3px;
      color: var(--code-text);
    }

    pre {
      background: var(--code-bg);
      padding: 12px 16px;
      border-radius: 6px;
      border: 1px solid var(--border);
      overflow-x: auto;
      margin: 1em 0;
      page-break-inside: avoid;
    }

    pre code {
      background: none;
      padding: 0;
      border-radius: 0;
      font-size: 9pt;
      line-height: 1.55;
    }

    blockquote {
      border-left: 3px solid var(--quote-border);
      margin: 1em 0;
      padding: 0.5em 1em;
      color: var(--quote-text);
      page-break-inside: avoid;
    }

    blockquote p { margin: 0.25em 0; }

    ul, ol {
      margin: 0.5em 0;
      padding-left: 1.8em;
    }

    li { margin: 0.2em 0; }
    li > ul, li > ol { margin: 0.1em 0; }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid var(--border);
      padding: 6px 10px;
      text-align: left;
    }

    th {
      background: var(--code-bg);
      font-weight: 600;
    }

    figure {
      margin: 1.2em 0;
      text-align: center;
      page-break-inside: avoid;
    }

    figure img {
      max-width: 100%;
      height: auto;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.5em 0;
    }

    ${highlightStyles}
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// ── Public API ──

export async function exportMarkdownToPdf(markdown: string, title: string, defaultPath?: string, docPath?: string) {
  const path = await pickSavePdfFile(defaultPath);
  if (!path) {
    return null;
  }
  if (!isTauri()) {
    throw new Error("PDF export requires the desktop app");
  }
  const payload = await markdownToPdfPayload(markdown, { title, docPath });
  const html = buildPdfHtml(payload);
  await invoke("export_pdf", { html, outputPath: path });
  return path;
}
