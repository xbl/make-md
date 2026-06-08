import type { Node as PMNode } from "prosemirror-model";
import { serializeMarkdown } from "@/editor/markdown-serializer";

export function buildSelectionRewriteContext(doc: PMNode, from: number, to: number) {
  const fullMarkdown = serializeMarkdown(doc);
  const selection = doc.textBetween(from, to, "\n");

  return {
    selection,
    sectionMarkdown: fullMarkdown,
    fullMarkdown,
    truncated: false,
  };
}

export function buildFullDocumentRewriteContext(fullMarkdown: string, maxTokens: number) {
  const estimatedTokens = Math.ceil(fullMarkdown.length / 4);
  if (estimatedTokens <= maxTokens * 0.8) {
    return {
      fullMarkdown,
      truncated: false,
    };
  }

  const head = fullMarkdown.slice(0, Math.floor(fullMarkdown.length * 0.7));
  const tail = fullMarkdown.slice(Math.floor(fullMarkdown.length * 0.9));

  return {
    fullMarkdown: `${head}\n...\n[content truncated]\n...\n${tail}`,
    truncated: true,
  };
}
