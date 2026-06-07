import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorState } from "prosemirror-state";
import type { MarkType, Schema } from "prosemirror-model";
import {
  canApplyEmInput,
  canApplyInlineInput,
  canApplyStrikeInput,
} from "@/editor/inline-mark/guards";
import { INPUT_RULE_PATTERNS } from "@/editor/inline-mark/syntax";

type MarkRule = {
  pattern: RegExp;
  mark: MarkType;
  guard: (state: EditorState, matched: string) => boolean;
  innerGroup?: number;
  attrs?: (match: RegExpMatchArray) => Record<string, unknown> | null;
};

function buildMarkRules(schema: Schema): MarkRule[] {
  const { strong, em, code, strike, link } = schema.marks;

  return [
    {
      pattern: INPUT_RULE_PATTERNS.strong,
      mark: strong,
      guard: (_state, _matched) => canApplyInlineInput(_state),
    },
    {
      pattern: INPUT_RULE_PATTERNS.strike,
      mark: strike,
      guard: (state, matched) => canApplyStrikeInput(state, matched),
    },
    {
      pattern: INPUT_RULE_PATTERNS.em,
      mark: em,
      guard: (state, matched) => canApplyEmInput(state, matched),
    },
    {
      pattern: /_([^_\n]+)_$/,
      mark: em,
      guard: (state, matched) => canApplyEmInput(state, matched),
    },
    {
      pattern: INPUT_RULE_PATTERNS.code,
      mark: code,
      guard: (_state, _matched) => canApplyInlineInput(_state),
    },
    {
      pattern: INPUT_RULE_PATTERNS.link,
      mark: link,
      innerGroup: 1,
      attrs: (match) => ({ href: match[2] ?? "", title: match[1] ?? "" }),
      guard: (_state, _matched) => canApplyInlineInput(_state),
    },
  ];
}

/**
 * Typora-style inline mark triggers via handleTextInput + replaceWith.
 * More reliable than mark InputRules when closing delimiters overlap typed chars.
 */
export function createInlineMarkTextInputPlugin(schema: Schema) {
  const rules = buildMarkRules(schema);

  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (view.composing || !text) {
          return false;
        }

        const { state } = view;
        if (!canApplyInlineInput(state)) {
          return false;
        }

        const $from = state.doc.resolve(from);
        if (!$from.parent.isTextblock || $from.parent.type.spec.code) {
          return false;
        }

        if ($from.marks().some((mark) => mark.type.spec.code)) {
          return false;
        }

        const blockStart = $from.start();
        const before = state.doc.textBetween(blockStart, from, null, "\ufffc") + text;

        for (const rule of rules) {
          const match = rule.pattern.exec(before);
          if (!match || match[0].length < text.length) {
            continue;
          }

          const innerGroup = rule.innerGroup ?? 1;
          const inner = match[innerGroup] ?? "";
          if (!inner || !rule.guard(state, match[0])) {
            continue;
          }

          const matchStart = blockStart + before.length - match[0].length;
          const attrs = rule.attrs?.(match) ?? null;
          const mark = rule.mark.create(attrs);
          const node = schema.text(inner, [mark]);

          let tr = state.tr.replaceWith(matchStart, from, node);
          const cursor = matchStart + node.nodeSize;
          tr = tr.setSelection(TextSelection.create(tr.doc, cursor));
          view.dispatch(tr.scrollIntoView());
          return true;
        }

        return false;
      },
    },
  });
}
