import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { MarkType } from "prosemirror-model";

export const inlineMarkSyntaxKey = new PluginKey("inlineMarkSyntax");

const MARK_ORDER = ["code", "strong", "em", "strike", "link"] as const;

function hrefForLinkRange(state: EditorState, from: number, to: number): string {
  const { link } = state.schema.marks;
  let href = "";
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

function findMarkedRange(
  state: EditorState,
  markType: MarkType,
): { from: number; to: number } | null {
  const { $from, empty } = state.selection;
  if (!empty || !markType.isInSet($from.marks())) {
    return null;
  }

  const parent = $from.parent;
  if (!parent.isTextblock) {
    return null;
  }

  const parentStart = $from.start();
  let startIndex = $from.index();
  let endIndex = $from.index();

  while (startIndex > 0) {
    const prev = parent.child(startIndex - 1);
    if (!prev.isText || !markType.isInSet(prev.marks)) {
      break;
    }
    startIndex -= 1;
  }

  while (endIndex + 1 < parent.childCount) {
    const next = parent.child(endIndex + 1);
    if (!next.isText || !markType.isInSet(next.marks)) {
      break;
    }
    endIndex += 1;
  }

  let from = parentStart;
  for (let i = 0; i < startIndex; i += 1) {
    from += parent.child(i).nodeSize;
  }

  let to = from;
  for (let i = startIndex; i <= endIndex; i += 1) {
    to += parent.child(i).nodeSize;
  }

  return { from, to };
}

function buildSyntaxDecorations(state: EditorState): DecorationSet {
  const { schema, selection } = state;
  if (!selection.empty) {
    return DecorationSet.empty;
  }

  for (const name of MARK_ORDER) {
    const markType = schema.marks[name];
    if (!markType) {
      continue;
    }

    const range = findMarkedRange(state, markType);
    if (!range) {
      continue;
    }

    const attrs: Record<string, string> = {
      class: `pm-mark-editing pm-mark-editing--${name}`,
    };
    if (name === "link") {
      attrs["data-href"] = hrefForLinkRange(state, range.from, range.to);
    }

    return DecorationSet.create(state.doc, [
      Decoration.inline(range.from, range.to, attrs),
    ]);
  }

  return DecorationSet.empty;
}

export function createInlineMarkSyntaxPlugin() {
  return new Plugin({
    key: inlineMarkSyntaxKey,
    state: {
      init: (_, state) => buildSyntaxDecorations(state),
      apply(tr, value, _oldState, newState) {
        if (tr.docChanged || tr.selectionSet) {
          return buildSyntaxDecorations(newState);
        }
        return value.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return inlineMarkSyntaxKey.getState(state);
      },
    },
  });
}
