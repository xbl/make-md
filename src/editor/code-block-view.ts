import mermaid from "mermaid";
import type { Node as PMNode } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

let mermaidReady = false;

function ensureMermaid(theme: "dark" | "default") {
  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      securityLevel: "loose",
    });
    mermaidReady = true;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
  wrapper.appendChild(pre);

  const preview = document.createElement("div");
  preview.className = "mermaid-preview";
  preview.hidden = true;

  const language = node.attrs.params ?? "";
  if (language) {
    wrapper.dataset.language = language;
  }
  if (language === "mermaid") {
    wrapper.classList.add("code-block-wrapper--mermaid");
    wrapper.appendChild(preview);
  }

  let renderTimer: ReturnType<typeof setTimeout> | null = null;
  let renderId = 0;

  async function renderMermaid(source: string) {
    if (language !== "mermaid") {
      return;
    }
    preview.hidden = false;
    const currentId = ++renderId;
    ensureMermaid(document.documentElement.dataset.theme === "light" ? "default" : "dark");
    try {
      const id = `mmd-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, source.trim() || "graph TD\n  A[Start] --> B[End]");
      if (currentId !== renderId) {
        return;
      }
      preview.innerHTML = svg;
    } catch {
      if (currentId !== renderId) {
        return;
      }
      preview.innerHTML = `<pre class="mermaid-error">${escapeHtml(source)}</pre>`;
    }
  }

  function scheduleMermaidRender(source: string) {
    if (language !== "mermaid") {
      return;
    }
    if (renderTimer) {
      clearTimeout(renderTimer);
    }
    renderTimer = setTimeout(() => {
      renderTimer = null;
      void renderMermaid(source);
    }, 350);
  }

  scheduleMermaidRender(node.textContent);

  return {
    dom: wrapper,
    contentDOM: code,
    update(updatedNode) {
      if (updatedNode.type.name !== "code_block") {
        return false;
      }
      const lang = updatedNode.attrs.params ?? "";
      if (lang) {
        wrapper.dataset.language = lang;
      } else {
        delete wrapper.dataset.language;
      }
      scheduleMermaidRender(updatedNode.textContent);
      return true;
    },
    destroy() {
      if (renderTimer) {
        clearTimeout(renderTimer);
      }
    },
  };
}

export function createEditorNodeViews() {
  return {
    code_block: createCodeBlockNodeView,
  };
}
