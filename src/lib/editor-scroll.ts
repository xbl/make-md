import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

const EDITOR_SCROLL_SELECTOR = ".app-shell__editor";

let outlineNavigationLock = false;
let outlineNavigationTimer: ReturnType<typeof setTimeout> | null = null;

export function scrollEditorToPosition(view: EditorView, pos: number) {
  if (outlineNavigationLock) {
    return;
  }

  outlineNavigationLock = true;
  if (outlineNavigationTimer) {
    clearTimeout(outlineNavigationTimer);
  }
  outlineNavigationTimer = setTimeout(() => {
    outlineNavigationLock = false;
  }, 250);

  const resolved = view.state.doc.resolve(Math.min(pos + 1, view.state.doc.content.size));
  const selection = TextSelection.near(resolved);
  const nodeDom =
    typeof (view as EditorView & { nodeDOM?: (pos: number) => unknown }).nodeDOM === "function"
      ? (view as EditorView & { nodeDOM: (pos: number) => unknown }).nodeDOM(resolved.pos)
      : null;
  const scrollTarget =
    nodeDom instanceof HTMLElement
      ? nodeDom
      : nodeDom instanceof Text
        ? nodeDom.parentElement
        : null;

  if (scrollTarget) {
    scrollTarget.scrollIntoView({ block: "center", inline: "nearest" });
  } else {
    const scrollContainer = document.querySelector(EDITOR_SCROLL_SELECTOR);
    if (scrollContainer instanceof HTMLElement) {
      const coords = view.coordsAtPos(resolved.pos);
      const containerRect = scrollContainer.getBoundingClientRect();
      const offsetInContainer = coords.top - containerRect.top + scrollContainer.scrollTop;
      const targetScrollTop = offsetInContainer - scrollContainer.clientHeight * 0.28;

      scrollContainer.scrollTop = Math.max(0, targetScrollTop);
    }
  }

  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView().setMeta("addToHistory", false));

  view.dom.focus({ preventScroll: true });
}
