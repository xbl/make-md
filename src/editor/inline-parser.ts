import { markdownSchema } from "@/editor/schema";
import type { Fragment, MarkType, Node as PMNode } from "prosemirror-model";
import {
  tokenizeInlineMarkdown,
  type InlineToken,
} from "@/editor/inline-mark/syntax";

export { tokenizeInlineMarkdown as tokenizeInline } from "@/editor/inline-mark/syntax";
export type { InlineToken } from "@/editor/inline-mark/syntax";

function applyMark(node: PMNode, markType: MarkType, attrs?: Record<string, unknown>): PMNode {
  const mark = markType.create(attrs);
  return node.mark(mark.addToSet(node.marks));
}

function tokenToNodes(token: InlineToken): PMNode[] {
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
      for (const node of tokenToNodes(innerToken)) {
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
    return [nodes.image.create({ src: token.src, alt: token.alt, title: token.alt || null })];
  }
  return [];
}

export function parseInline(text: string): Fragment {
  const children: PMNode[] = [];
  for (const token of tokenizeInlineMarkdown(text)) {
    children.push(...tokenToNodes(token));
  }
  if (children.length === 0) {
    return markdownSchema.nodes.paragraph.createAndFill(null)!.content;
  }
  return markdownSchema.nodes.paragraph.createAndFill(null, children)!.content;
}

export function paragraphFromMarkdown(text: string): PMNode {
  const inline = parseInline(text);
  if (inline.childCount === 1 && inline.firstChild?.type.name === "image") {
    return markdownSchema.nodes.paragraph.createAndFill(null, inline)!;
  }
  return markdownSchema.nodes.paragraph.createAndFill(null, inline)!;
}
