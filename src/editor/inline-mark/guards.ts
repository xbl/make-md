import type { EditorState } from "prosemirror-state";

export function canApplyInlineInput(state: EditorState): boolean {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) {
    return false;
  }
  if ($from.parent.type.spec.code) {
    return false;
  }
  if (state.selection.from !== state.selection.to) {
    return false;
  }
  return !$from.marks().some((mark) => mark.type.name === "code");
}
