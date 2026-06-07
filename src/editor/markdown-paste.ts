import { Fragment, Slice } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { parseMarkdown } from "@/editor/markdown-parser";

function isStructuredMarkdown(text: string) {
  return text.includes("\n") && (
    text.includes("```")
    || /^#{1,6}\s/m.test(text)
    || /^\s*[-*+]\s/m.test(text)
    || /^\s*\d+\.\s/m.test(text)
    || /^\s*>\s?/m.test(text)
    || /^\|.+\|/m.test(text)
  );
}

function parsedDocToSlice(text: string) {
  const doc = parseMarkdown(text);
  return new Slice(Fragment.from(doc.content), 0, 0);
}

export function handleMarkdownPaste(view: EditorView, text: string): boolean {
  if (!text || !isStructuredMarkdown(text)) {
    return false;
  }

  const { state } = view;
  const { $from } = state.selection;
  if ($from.parent.type.spec.code) {
    return false;
  }

  view.dispatch(state.tr.replaceSelection(parsedDocToSlice(text)));
  return true;
}

export function createMarkdownPastePlugin() {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        return handleMarkdownPaste(view, text);
      },
    },
  });
}
