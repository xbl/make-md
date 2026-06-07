import type { EditorState, Transaction } from "prosemirror-state";

export function replaceDocumentText(state: EditorState, tr: Transaction, text: string) {
  return tr.replaceWith(0, state.doc.content.size, state.schema.text(text));
}
