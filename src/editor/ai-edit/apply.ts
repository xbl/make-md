import type { EditorView } from "prosemirror-view";

export function applySelectionRewrite(view: EditorView, from: number, to: number, text: string) {
  view.dispatch(view.state.tr.insertText(text, from, to));
}
