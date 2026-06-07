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
  if (!empty) {
    return null;
  }

  const marks = state.storedMarks ?? $from.marks();
  if (!markType.isInSet(marks)) {
    return null;
  }

  const parent = $from.parent;
  if (!parent.isTextblock) {
    return null;
  }

  const blockStart = $from.start();
  const blockEnd = $from.end();
  let from = $from.pos;
  let to = $from.pos;

  while (from > blockStart) {
    const $pos = state.doc.resolve(from - 1);
    if ($pos.start() !== blockStart || !markType.isInSet($pos.marks())) {
      break;
    }
    from -= 1;
  }

  while (to < blockEnd) {
    const $pos = state.doc.resolve(to);
    if ($pos.start() !== blockStart || !markType.isInSet($pos.marks())) {
      break;
    }
    to += 1;
  }

  return from < to ? { from, to } : null;
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
