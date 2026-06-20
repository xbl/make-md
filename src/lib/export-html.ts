import { marked } from "marked";
import highlightStyles from "highlight.js/styles/github.min.css?inline";
import {
  highlightCode,
  isMermaidLanguage,
  resolveHighlightLanguage,
} from "@/editor/syntax-highlight/languages";
import { resolveMarkdownImageDisplaySrc } from "@/lib/markdown-image-src";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function encodeMarkdownImageUrls(markdown: string) {
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+(?:\s[^)\s]+)*)(?:\s+"([^"]*)")?\)/g, (_match, alt, src, title) => {
    const encodedSrc = encodeURI(String(src)).replace(/#/g, "%23");
    return title
      ? `![${alt}](${encodedSrc} "${title}")`
      : `![${alt}](${encodedSrc})`;
  });
}

export function markdownToHtml(markdown: string, title = "Document", docPath?: string): string {
  let hasMermaid = false;
  const normalizedMarkdown = encodeMarkdownImageUrls(markdown);

  marked.use({
    renderer: {
      code({ text, lang }) {
        if (lang && isMermaidLanguage(lang)) {
          hasMermaid = true;
          return `<pre class="mermaid">${escapeHtml(text)}</pre>`;
        }

        const language = resolveHighlightLanguage(lang);
        const highlighted = highlightCode(text, language);
        return `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>`;
      },
      image({ href, title, text }) {
        const resolvedSrc = resolveMarkdownImageDisplaySrc(href, docPath);
        const alt = escapeHtml(text ?? "");
        const safeTitle = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${escapeHtml(resolvedSrc)}" alt="${alt}"${safeTitle} />`;
      },
    },
  });

  const body = marked.parse(normalizedMarkdown, { async: false }) as string;

  const mermaidScript = hasMermaid
    ? `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: "dark", securityLevel: "loose" });
</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.7; max-width: 860px; margin: 40px auto; padding: 0 24px; color: #1a202c; }
    pre:not(.mermaid) { background: #f7fafc; padding: 16px; border-radius: 8px; overflow-x: auto; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    blockquote { border-left: 4px solid #667eea; margin: 1em 0; padding-left: 1em; color: #4a5568; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background: #edf2f7; }
    img { max-width: 100%; }
    ${highlightStyles}
  </style>
</head>
<body>
${body}
${mermaidScript}
</body>
</html>`;
}
