import { Fragment, Slice } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { parseMarkdown } from "@/editor/markdown-parser";

export function applySelectionRewrite(view: EditorView, from: number, to: number, text: string) {
  if (!text) return;

  const doc = parseMarkdown(text);
  const slice = new Slice(Fragment.from(doc.content), 0, 0);

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, from, to))
      .replaceSelection(slice),
  );
}
