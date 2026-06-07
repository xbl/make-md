import { Fragment, Slice, type MarkType, type Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { tokenizeInlineMarkdown, type InlineToken } from "@/editor/inline-mark/syntax";
import { containsInlineMarkdown } from "@/editor/inline-mark/syntax";

function applyMark(node: ReturnType<Schema["text"]>, markType: MarkType, attrs?: Record<string, unknown>) {
  return node.mark(markType.create(attrs).addToSet(node.marks));
}

function tokensToFragment(schema: Schema, tokens: InlineToken[]): Fragment {
  const nodes: ReturnType<Schema["text"]>[] = [];

  for (const token of tokens) {
    if (token.type === "text") {
      if (token.value) {
        nodes.push(schema.text(token.value));
      }
      continue;
    }
    if (token.type === "strong") {
      nodes.push(applyMark(schema.text(token.value), schema.marks.strong));
      continue;
    }
    if (token.type === "em") {
      nodes.push(applyMark(schema.text(token.value), schema.marks.em));
      continue;
    }
    if (token.type === "code") {
      nodes.push(applyMark(schema.text(token.value), schema.marks.code));
      continue;
    }
    if (token.type === "strike") {
      nodes.push(applyMark(schema.text(token.value), schema.marks.strike));
      continue;
    }
    if (token.type === "link") {
      const linkMark = schema.marks.link.create({ href: token.href, title: token.text });
      const inner = tokenizeInlineMarkdown(token.text);
      for (const innerToken of inner) {
        if (innerToken.type === "text" && innerToken.value) {
          nodes.push(schema.text(innerToken.value, [linkMark]));
        } else if (innerToken.type === "strong") {
          nodes.push(
            schema.text(innerToken.value, [linkMark, schema.marks.strong.create()]),
          );
        } else if (innerToken.type === "em") {
          nodes.push(schema.text(innerToken.value, [linkMark, schema.marks.em.create()]));
        } else if (innerToken.type === "code") {
          nodes.push(schema.text(innerToken.value, [linkMark, schema.marks.code.create()]));
        }
      }
      continue;
    }
    if (token.type === "image") {
      nodes.push(
        schema.nodes.image.create({
          src: token.src,
          alt: token.alt,
          title: token.alt || null,
        }),
      );
    }
  }

  return Fragment.fromArray(nodes);
}

export function handleInlineMarkdownPaste(view: EditorView, text: string): boolean {
  if (!text || text.includes("\n") || !containsInlineMarkdown(text)) {
    return false;
  }

  const { state } = view;
  const { $from } = state.selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) {
    return false;
  }

  const fragment = tokensToFragment(state.schema, tokenizeInlineMarkdown(text));
  if (fragment.size === 0) {
    return false;
  }

  view.dispatch(state.tr.replaceSelection(new Slice(fragment, 0, 0)));
  return true;
}
