import { Plugin } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import {
  highlightCode,
  isMermaidLanguage,
  resolveHighlightLanguage,
} from "@/editor/syntax-highlight/languages";

export type CodeBlockHighlightTarget = {
  pos: number;
  text: string;
  language: string;
  nodeSize: number;
};

export function collectCodeBlocksForHighlight(doc: PMNode): CodeBlockHighlightTarget[] {
  const blocks: CodeBlockHighlightTarget[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "code_block") {
      return;
    }

    const params = node.attrs.params ?? "";
    if (isMermaidLanguage(params)) {
      return;
    }

    blocks.push({
      pos,
      text: node.textContent,
      language: params.trim() ? resolveHighlightLanguage(params) : "plaintext",
      nodeSize: node.nodeSize,
    });
  });

  return blocks;
}

function cacheKey(pos: number, text: string, language: string): string {
  return `${pos}:${language}:${text}`;
}

function getDebounceMs(doc: PMNode): number {
  return doc.content.size > 500 ? 300 : 150;
}

function syncOverlayScroll(pre: HTMLElement, overlay: HTMLElement) {
  overlay.scrollLeft = pre.scrollLeft;
  overlay.scrollTop = pre.scrollTop;
}

function bindScrollSync(pre: HTMLElement, overlay: HTMLElement, bound: WeakSet<HTMLElement>) {
  if (bound.has(pre)) {
    return;
  }

  bound.add(pre);
  pre.addEventListener("scroll", () => syncOverlayScroll(pre, overlay), { passive: true });
}

function resolveCodeBlockWrapper(view: EditorView, pos: number): HTMLElement | null {
  const dom = view.nodeDOM(pos);
  if (dom instanceof HTMLElement && dom.classList.contains("code-block-wrapper")) {
    return dom;
  }

  if (dom instanceof HTMLElement) {
    return dom.closest(".code-block-wrapper");
  }

  if (dom instanceof Text) {
    return dom.parentElement?.closest(".code-block-wrapper") ?? null;
  }

  return null;
}

function updateBlockHighlight(
  view: EditorView,
  block: CodeBlockHighlightTarget,
  cache: Map<string, string>,
  bound: WeakSet<HTMLElement>,
) {
  const dom = resolveCodeBlockWrapper(view, block.pos);
  if (!(dom instanceof HTMLElement)) {
    return false;
  }

  const pre = dom.querySelector("pre");
  const overlay = dom.querySelector(".hljs-overlay");
  if (!(pre instanceof HTMLElement) || !(overlay instanceof HTMLElement)) {
    return false;
  }

  const key = cacheKey(block.pos, block.text, block.language);
  let html = cache.get(key);
  if (!html) {
    const highlighted = highlightCode(block.text, block.language);
    html = `<code class="hljs language-${block.language}">${highlighted}</code>`;
    cache.set(key, html);
  }

  overlay.innerHTML = html;
  dom.dataset.highlighted = "true";
  bindScrollSync(pre, overlay, bound);
  syncOverlayScroll(pre, overlay);
  return true;
}

export function createSyntaxHighlightPlugin() {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;
  const cache = new Map<string, string>();
  const boundScroll = new WeakSet<HTMLElement>();

  function scheduleUpdate(view: EditorView) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const blocks = collectCodeBlocksForHighlight(view.state.doc);
      let highlightedCount = 0;
      for (const block of blocks) {
        if (updateBlockHighlight(view, block, cache, boundScroll)) {
          highlightedCount += 1;
        }
      }

      if (blocks.length === 0 || highlightedCount === blocks.length) {
        retryCount = 0;
        return;
      }

      if (retryCount >= 6) {
        retryCount = 0;
        return;
      }

      retryCount += 1;
      scheduleUpdate(view);
    }, getDebounceMs(view.state.doc));
  }

  return new Plugin({
    view(view) {
      retryCount = 0;
      scheduleUpdate(view);

      return {
        update(nextView, prevState) {
          if (nextView.state.doc !== prevState.doc) {
            retryCount = 0;
          }
          scheduleUpdate(nextView);
        },
        destroy() {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
        },
      };
    },
  });
}
