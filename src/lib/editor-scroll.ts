import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

const EDITOR_SCROLL_SELECTOR = ".app-shell__editor";

export function scrollEditorToPosition(view: EditorView, pos: number) {
  const selection = TextSelection.near(view.state.doc.resolve(pos + 1));
  view.dispatch(view.state.tr.setSelection(selection));

  const scrollContainer = document.querySelector(EDITOR_SCROLL_SELECTOR);
  if (!(scrollContainer instanceof HTMLElement)) {
    view.dom.focus({ preventScroll: true });
    return;
  }

  const coords = view.coordsAtPos(selection.from);
  const containerRect = scrollContainer.getBoundingClientRect();
  const offsetInContainer = coords.top - containerRect.top + scrollContainer.scrollTop;
  const targetScrollTop = offsetInContainer - scrollContainer.clientHeight * 0.28;

  scrollContainer.scrollTo({
    top: Math.max(0, targetScrollTop),
    behavior: "smooth",
  });

  view.dom.focus({ preventScroll: true });
}
