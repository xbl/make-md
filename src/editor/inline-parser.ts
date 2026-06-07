import { markdownSchema } from "@/editor/schema";
import type { Fragment, MarkType, Node as PMNode } from "prosemirror-model";

type InlineToken =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; text: string; href: string }
  | { type: "image"; alt: string; src: string };

const INLINE_PATTERN =
  /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]*)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      tokens.push({ type: "image", alt: match[1], src: match[2] });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      tokens.push({ type: "link", text: match[3], href: match[4] });
    } else if (match[5] !== undefined) {
      tokens.push({ type: "strong", value: match[5] });
    } else if (match[6] !== undefined || match[7] !== undefined) {
      tokens.push({ type: "em", value: match[6] ?? match[7]! });
    } else if (match[8] !== undefined) {
      tokens.push({ type: "code", value: match[8] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (tokens.length === 0 && text) {
    tokens.push({ type: "text", value: text });
  }

  return tokens;
}

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
  if (token.type === "link") {
    const linkMark = markdownSchema.marks.link;
    const inner = parseInline(token.text);
    const output: PMNode[] = [];
    inner.forEach((node) => {
      output.push(
        node.isText
          ? node.mark(
              linkMark.create({ href: token.href, title: token.text }).addToSet(node.marks),
            )
          : node,
      );
    });
    return output;
  }
  if (token.type === "image") {
    return [nodes.image.create({ src: token.src, alt: token.alt, title: token.alt || null })];
  }
  return [];
}

export function parseInline(text: string): Fragment {
  const children: PMNode[] = [];
  for (const token of tokenizeInline(text)) {
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
