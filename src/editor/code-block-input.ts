import { InputRule } from "prosemirror-inputrules";
import { exitCode } from "prosemirror-commands";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import { markdownSchema } from "@/editor/schema";

function lineRangeInCodeBlock(state: EditorState, pos: number) {
  const $pos = state.doc.resolve(pos);
  if (!$pos.parent.type.spec.code) {
    return null;
  }

  const blockStart = $pos.start();
  const offset = pos - blockStart;
  const text = $pos.parent.textContent;
  const lineStartOffset = text.lastIndexOf("\n", offset - 1) + 1;
  const nextBreak = text.indexOf("\n", offset);
  const lineEndOffset = nextBreak === -1 ? text.length : nextBreak;

  return {
    blockStart,
    lineStart: blockStart + lineStartOffset,
    lineEnd: blockStart + lineEndOffset,
  };
}

function closeCodeFenceRule() {
  return new InputRule(
    /(?:^|\n)```([a-zA-Z0-9+#.-]*)$/,
    (state, match, start, end) => {
      const range = lineRangeInCodeBlock(state, end);
      if (!range) {
        return null;
      }

      const { blockStart, lineStart, lineEnd } = range;
      const matched = match[0];
      const fenceStart = matched.startsWith("\n") ? lineStart : lineStart;
      let deleteFrom = fenceStart;
      const deleteTo = Math.max(lineEnd, end);

      if (matched.startsWith("\n") && deleteFrom > blockStart + 1) {
        deleteFrom -= 1;
      }

      let tr = state.tr.delete(deleteFrom, deleteTo);
      const block = tr.doc.nodeAt(blockStart);
      const isEmpty = !block?.textContent.trim();

      if (isEmpty) {
        tr = tr.setBlockType(blockStart, blockStart, markdownSchema.nodes.paragraph);
        return tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + 1), 1));
      }

      const afterBlock = blockStart + block!.nodeSize;
      const paragraph = markdownSchema.nodes.paragraph.create();
      tr = tr.insert(afterBlock, paragraph);
      return tr.setSelection(TextSelection.near(tr.doc.resolve(afterBlock + 1), 1));
    },
    { inCode: true },
  );
}

function exitCodeOnEmptyLine(state: EditorState, dispatch?: (tr: import("prosemirror-state").Transaction) => void) {
  const { $head } = state.selection;
  if (!$head.parent.type.spec.code || !state.selection.empty) {
    return false;
  }

  const text = $head.parent.textContent;
  const lineStart = text.lastIndexOf("\n", $head.parentOffset - 1) + 1;
  const line = text.slice(lineStart, $head.parentOffset);
  if (line.trim() !== "") {
    return false;
  }

  return exitCode(state, dispatch);
}

export function createCodeBlockInputRules() {
  return [closeCodeFenceRule()];
}

export function createCodeBlockKeymap() {
  return {
    Enter: exitCodeOnEmptyLine,
  };
}

export function createCodeBlockPlugin() {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "ArrowDown") {
          return false;
        }

        const { state } = view;
        const { $head } = state.selection;
        if (!$head.parent.type.spec.code || !state.selection.empty) {
          return false;
        }

        const atEnd = $head.parentOffset === $head.parent.textContent.length;
        const after = $head.after();
        const docEnd = state.doc.content.size;
        if (!atEnd || after >= docEnd) {
          return exitCode(state, view.dispatch);
        }

        return false;
      },
    },
  });
}
