import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { createEditorInputRules } from "@/editor/input-rules";
import { createFindReplacePlugin } from "@/editor/find-replace-plugin";

export function createEditorPlugins() {
  return [createEditorInputRules(), createFindReplacePlugin(), history(), keymap(baseKeymap)];
}
