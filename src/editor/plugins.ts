import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { createEditorInputRules } from "@/editor/input-rules";

export function createEditorPlugins() {
  return [createEditorInputRules(), history(), keymap(baseKeymap)];
}
