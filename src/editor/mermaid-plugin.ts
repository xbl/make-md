import mermaid from "mermaid";
import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const mermaidPluginKey = new PluginKey("mermaid");

let mermaidReady = false;
let mermaidTheme: "dark" | "default" | null = null;

export function isMermaidLanguage(lang: string) {
  return lang.trim().toLowerCase() === "mermaid";
}

function currentMermaidTheme(): "dark" | "default" {
  return document.documentElement.dataset.theme === "light" ? "default" : "dark";
}

function ensureMermaid(theme: "dark" | "default") {
  if (!mermaidReady || mermaidTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel: "loose",
    });
    mermaidReady = true;
    mermaidTheme = theme;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

class MermaidPreviewHost {
  readonly dom: HTMLElement;
  private source = "";
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private renderId = 0;

  constructor() {
    this.dom = document.createElement("div");
    this.dom.className = "mermaid-preview";
    this.dom.setAttribute("contenteditable", "false");
    this.dom.hidden = true;
  }

  updateSource(source: string) {
    if (source === this.source) {
      return;
    }
    this.source = source;
    this.scheduleRender();
  }

  destroy() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
  }

  private scheduleRender() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      void this.render();
    }, 200);
  }

  private async render() {
    this.dom.hidden = false;
    this.dom.classList.remove("mermaid-preview--ready");
    const currentId = ++this.renderId;
    ensureMermaid(currentMermaidTheme());

    try {
      const id = `mmd-${Math.random().toString(36).slice(2)}`;
      const { svg, bindFunctions } = await mermaid.render(
        id,
        this.source.trim() || "graph TD\n  A[Start] --> B[End]",
      );
      if (currentId !== this.renderId || !this.dom.isConnected) {
        return;
      }
      this.dom.innerHTML = svg;
      bindFunctions?.(this.dom);
      this.dom.classList.add("mermaid-preview--ready");
    } catch {
      if (currentId !== this.renderId || !this.dom.isConnected) {
        return;
      }
      this.dom.innerHTML = `<pre class="mermaid-error">${escapeHtml(this.source)}</pre>`;
    }
  }
}

function buildDecorations(doc: PMNode, hosts: Map<string, MermaidPreviewHost>) {
  const decorations: Decoration[] = [];
  const activeKeys = new Set<string>();

  doc.descendants((node, pos) => {
    if (node.type.name !== "code_block") {
      return;
    }
    if (!isMermaidLanguage(node.attrs.params ?? "")) {
      return;
    }

    const key = `mermaid-${pos}`;
    activeKeys.add(key);

    let host = hosts.get(key);
    if (!host) {
      host = new MermaidPreviewHost();
      hosts.set(key, host);
    }
    host.updateSource(node.textContent);

    decorations.push(
      Decoration.widget(pos + node.nodeSize, host.dom, {
        side: 1,
        key,
      }),
    );
  });

  for (const [key, host] of hosts) {
    if (!activeKeys.has(key)) {
      host.destroy();
      hosts.delete(key);
    }
  }

  return DecorationSet.create(doc, decorations);
}

export function createMermaidPlugin() {
  const hosts = new Map<string, MermaidPreviewHost>();

  return new Plugin({
    key: mermaidPluginKey,
    state: {
      init(_, { doc }) {
        return buildDecorations(doc, hosts);
      },
      apply(tr, set, _, state) {
        if (tr.docChanged) {
          return buildDecorations(state.doc, hosts);
        }
        return set.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return mermaidPluginKey.getState(state);
      },
    },
    destroy() {
      for (const host of hosts.values()) {
        host.destroy();
      }
      hosts.clear();
    },
  });
}
