import type { Node as PMNode } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

export function createCodeBlockNodeView(
  node: PMNode,
  _view: EditorView,
  _getPos: () => number | undefined,
): NodeView {
  const wrapper = document.createElement("div");
  wrapper.className = "code-block-wrapper";

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  pre.appendChild(code);

  const overlay = document.createElement("div");
  overlay.className = "hljs-overlay";
  overlay.setAttribute("aria-hidden", "true");

  wrapper.appendChild(overlay);
  wrapper.appendChild(pre);

  const language = node.attrs.params ?? "";
  if (language) {
    pre.dataset.params = language;
    wrapper.dataset.language = language;
  }

  return {
    dom: wrapper,
    contentDOM: code,
    update(updatedNode) {
      if (updatedNode.type.name !== "code_block") {
        return false;
      }
      const lang = updatedNode.attrs.params ?? "";
      if (lang) {
        pre.dataset.params = lang;
        wrapper.dataset.language = lang;
      } else {
        delete pre.dataset.params;
        delete wrapper.dataset.language;
      }
      return true;
    },
  };
}

export function createEditorNodeViews() {
  return {
    code_block: createCodeBlockNodeView,
  };
}
