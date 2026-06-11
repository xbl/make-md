import type { Node as PMNode } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

export function createImageNodeView(
  node: PMNode,
  _view: EditorView,
  _getPos: () => number | undefined,
): NodeView {
  const dom = document.createElement("img");

  function sync(nextNode: PMNode) {
    dom.src = String(nextNode.attrs.displaySrc ?? nextNode.attrs.src ?? "");
    dom.alt = String(nextNode.attrs.alt ?? "");
    if (nextNode.attrs.title) {
      dom.title = String(nextNode.attrs.title);
    } else {
      dom.removeAttribute("title");
    }
  }

  sync(node);

  return {
    dom,
    update(updatedNode) {
      if (updatedNode.type.name !== "image") {
        return false;
      }
      sync(updatedNode);
      return true;
    },
  };
}
