import { history } from "prosemirror-history";

export function createEditorPlugins() {
  return [history()];
}
