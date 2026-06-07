import type { Command } from "prosemirror-state";
import type { Schema } from "prosemirror-model";

function linkHrefAtSelection(schema: Schema, from: number, to: number, state: import("prosemirror-state").EditorState): string {
  const { link } = schema.marks;
  let href = "";

  if (from === to) {
    const mark = link.isInSet(state.selection.$from.marks());
    return mark?.attrs.href ?? "";
  }

  state.doc.nodesBetween(from, to, (node) => {
    if (node.isText && !href) {
      const mark = link.isInSet(node.marks);
      if (mark) {
        href = mark.attrs.href ?? "";
      }
    }
  });

  return href;
}

export function createEditLinkCommand(schema: Schema): Command {
  const { link } = schema.marks;

  return (state, dispatch, view) => {
    if (!dispatch || !view) {
      return false;
    }

    const { from, to, empty } = state.selection;
    const currentHref = linkHrefAtSelection(schema, from, to, state);
    const nextHref = window.prompt("Link URL", currentHref || "https://");

    if (nextHref === null) {
      return true;
    }

    if (!nextHref.trim()) {
      dispatch(state.tr.removeMark(from, to, link));
      return true;
    }

    const href = nextHref.trim();
    const mark = link.create({ href, title: null });

    if (empty) {
      const label = href;
      dispatch(
        state.tr
          .insertText(label, from, to)
          .addMark(from, from + label.length, mark),
      );
      return true;
    }

    dispatch(state.tr.removeMark(from, to, link).addMark(from, to, mark));
    return true;
  };
}
