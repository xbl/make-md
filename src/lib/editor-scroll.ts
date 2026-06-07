import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

const EDITOR_SCROLL_SELECTOR = ".app-shell__editor";
const OUTLINE_SCROLL_TOP_OFFSET = 56;

let outlineNavigationLock = false;
let outlineNavigationTimer: ReturnType<typeof setTimeout> | null = null;

function findEditorScrollContainer(view: EditorView): HTMLElement | null {
  let current: HTMLElement | null = view.dom;

  while (current) {
    const style = getComputedStyle(current);
    const canScrollY =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight + 1;

    if (canScrollY) {
      return current;
    }

    current = current.parentElement;
  }

  const fallback = document.querySelector(EDITOR_SCROLL_SELECTOR);
  return fallback instanceof HTMLElement ? fallback : null;
}

function clampScrollTop(container: HTMLElement, targetScrollTop: number) {
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
  container.scrollTop = Math.min(maxScroll, Math.max(0, targetScrollTop));
}

function scrollElementInContainer(element: HTMLElement, container: HTMLElement) {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offsetInContainer = elementRect.top - containerRect.top + container.scrollTop;

  clampScrollTop(container, offsetInContainer - OUTLINE_SCROLL_TOP_OFFSET);
}

function scrollCoordsInContainer(
  view: EditorView,
  pos: number,
  container: HTMLElement,
) {
  const coords = view.coordsAtPos(pos);
  const containerRect = container.getBoundingClientRect();
  const offsetInContainer = coords.top - containerRect.top + container.scrollTop;

  clampScrollTop(container, offsetInContainer - OUTLINE_SCROLL_TOP_OFFSET);
}

function resolveHeadingDom(view: EditorView, pos: number): HTMLElement | null {
  const dom = view.nodeDOM(pos);
  if (dom instanceof HTMLElement) {
    return dom;
  }
  if (dom instanceof Text) {
    return dom.parentElement;
  }
  return null;
}

function applyOutlineScroll(view: EditorView, pos: number, container: HTMLElement) {
  const resolvedPos = Math.min(pos + 1, view.state.doc.content.size);
  const headingDom = resolveHeadingDom(view, pos);
  if (headingDom) {
    scrollElementInContainer(headingDom, container);
    return;
  }
  scrollCoordsInContainer(view, resolvedPos, container);
}

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

  const scrollContainer = findEditorScrollContainer(view);
  const resolved = view.state.doc.resolve(Math.min(pos + 1, view.state.doc.content.size));
  const selection = TextSelection.near(resolved);

  if (!view.state.selection.eq(selection)) {
    view.dispatch(
      view.state.tr.setSelection(selection).setMeta("addToHistory", false),
    );
  }

  view.dom.focus({ preventScroll: true });

  if (!scrollContainer) {
    return;
  }

  const runScroll = () => applyOutlineScroll(view, pos, scrollContainer);

  runScroll();
  requestAnimationFrame(() => {
    runScroll();
    requestAnimationFrame(runScroll);
  });
}
