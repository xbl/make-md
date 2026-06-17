import { markdownSchema } from "@/editor/schema";
import type { Fragment, MarkType, Node as PMNode } from "prosemirror-model";
import {
  tokenizeInlineMarkdown,
  type InlineToken,
} from "@/editor/inline-mark/syntax";
import { resolveMarkdownImageDisplaySrc } from "@/lib/markdown-image-src";

export { tokenizeInlineMarkdown as tokenizeInline } from "@/editor/inline-mark/syntax";
export type { InlineToken } from "@/editor/inline-mark/syntax";

function applyMark(node: PMNode, markType: MarkType, attrs?: Record<string, unknown>): PMNode {
  const mark = markType.create(attrs);
  return node.mark(mark.addToSet(node.marks));
}

function tokenToNodes(token: InlineToken, docPath?: string): PMNode[] {
  const { nodes } = markdownSchema;

  if (token.type === "text") {
    return token.value ? [markdownSchema.text(token.value)] : [];
  }
  if (token.type === "strong") {
    return [applyMark(markdownSchema.text(token.value), markdownSchema.marks.strong)];
  }
  if (token.type === "em") {
    return [applyMark(markdownSchema.text(token.value), markdownSchema.marks.em)];
  }
  if (token.type === "code") {
    return [applyMark(markdownSchema.text(token.value), markdownSchema.marks.code)];
  }
  if (token.type === "strike") {
    return [applyMark(markdownSchema.text(token.value), markdownSchema.marks.strike)];
  }
  if (token.type === "link") {
    const linkMark = markdownSchema.marks.link;
    const inner = tokenizeInlineMarkdown(token.text);
    const output: PMNode[] = [];
    for (const innerToken of inner) {
      for (const node of tokenToNodes(innerToken, docPath)) {
        if (node.isText) {
          output.push(
            node.mark(
              linkMark.create({ href: token.href, title: token.text }).addToSet(node.marks),
            ),
          );
        } else {
          output.push(node);
        }
      }
    }
    return output;
  }
  if (token.type === "image") {
    let width: number | null = null;
    let height: number | null = null;
    let align: string | null = null;
    if (token.title) {
      const sizeMatch = /(\d+)x(\d+)/.exec(token.title);
      if (sizeMatch) {
        width = Number(sizeMatch[1]);
        height = Number(sizeMatch[2]);
      }
      const alignMatch = /align=(inline|left|center|right)/.exec(token.title);
      if (alignMatch) {
        align = alignMatch[1];
      }
    }
    return [
      nodes.image.create({
        src: token.src,
        alt: token.alt,
        title: token.title || null,
        displaySrc: resolveMarkdownImageDisplaySrc(token.src, docPath),
        width,
        height,
        align: align || "inline",
      }),
    ];
  }
  return [];
}

function parseInlineSegment(text: string, docPath?: string): PMNode[] {
  const children: PMNode[] = [];
  for (const token of tokenizeInlineMarkdown(text)) {
    children.push(...tokenToNodes(token, docPath));
  }
  return children;
}

export function parseInline(text: string, docPath?: string): Fragment {
  const children: PMNode[] = [];
  const segments = text.split(/<br\s*\/?>/i);
  segments.forEach((segment, index) => {
    children.push(...parseInlineSegment(segment, docPath));
    if (index < segments.length - 1) {
      children.push(markdownSchema.nodes.hard_break.create());
    }
  });

  if (children.length === 0) {
    return markdownSchema.nodes.paragraph.createAndFill(null)!.content;
  }

  return markdownSchema.nodes.paragraph.createAndFill(null, children)!.content;
}

export function paragraphFromMarkdown(text: string, docPath?: string): PMNode {
  const inline = parseInline(text, docPath);
  if (inline.childCount === 1 && inline.firstChild?.type.name === "image") {
    return markdownSchema.nodes.paragraph.createAndFill(null, inline)!;
  }
  return markdownSchema.nodes.paragraph.createAndFill(null, inline)!;
}
