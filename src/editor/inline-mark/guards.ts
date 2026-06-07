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

/** Skip em while user is still typing `**bold**` (e.g. `**ddd*`). */
export function canApplyEmInput(state: EditorState, textBefore: string): boolean {
  if (!canApplyInlineInput(state)) {
    return false;
  }
  if (/\*\*[^*\n]*\*$/.test(textBefore) && !/\*\*[^*\n]+\*\*$/.test(textBefore)) {
    return false;
  }
  return true;
}

/** Skip strike while user is still typing `~~strike~~` (e.g. `~~ddd~`). */
export function canApplyStrikeInput(state: EditorState, textBefore: string): boolean {
  if (!canApplyInlineInput(state)) {
    return false;
  }
  if (/~~[^~\n]*~$/.test(textBefore) && !/~~[^~\n]+~~$/.test(textBefore)) {
    return false;
  }
  return true;
}
