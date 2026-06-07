import { InputRule } from "prosemirror-inputrules";
import type { MarkType } from "prosemirror-model";
import type { Schema } from "prosemirror-model";
import {
  canApplyEmInput,
  canApplyInlineInput,
  canApplyStrikeInput,
} from "@/editor/inline-mark/guards";
import { INPUT_RULE_PATTERNS } from "@/editor/inline-mark/syntax";
import type { EditorState } from "prosemirror-state";

type InputGuard = (state: EditorState, textBefore: string) => boolean;

function inlineOnly(state: EditorState, _textBefore: string) {
  return canApplyInlineInput(state);
}

function markInputRule(
  regexp: RegExp,
  markType: MarkType,
  canApply: InputGuard,
  textGroup = 1,
): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    if (!canApply(state, match[0])) {
      return null;
    }

    const mark = markType.create();
    const full = match[0];
    const inner = match[textGroup] ?? "";
    if (!inner) {
      return null;
    }

    const prefixLen = full.indexOf(inner);
    const suffixLen = full.length - prefixLen - inner.length;
    const from = start + prefixLen;
    const to = from + inner.length;

    let tr = state.tr;
    if (suffixLen > 0) {
      tr = tr.delete(to, end);
    }
    if (prefixLen > 0) {
      tr = tr.delete(start, from);
    }

    const markFrom = start;
    const markTo = start + inner.length;
    return tr.removeMark(markFrom, markTo, markType).addMark(markFrom, markTo, mark);
  });
}

function linkInputRule(schema: Schema): InputRule {
  const { link } = schema.marks;

  return new InputRule(INPUT_RULE_PATTERNS.link, (state, match, start, end) => {
    if (!canApplyInlineInput(state)) {
      return null;
    }

    const full = match[0];
    const text = match[1] ?? "";
    const href = match[2] ?? "";
    if (!text || !href) {
      return null;
    }

    const prefixLen = full.indexOf(text);
    const suffixLen = full.length - prefixLen - text.length;
    const from = start + prefixLen;
    const to = from + text.length;

    let tr = state.tr;
    if (suffixLen > 0) {
      tr = tr.delete(to, end);
    }
    if (prefixLen > 0) {
      tr = tr.delete(start, from);
    }

    const markFrom = start;
    const markTo = start + text.length;
    const mark = link.create({ href, title: text });
    return tr.removeMark(markFrom, markTo, link).addMark(markFrom, markTo, mark);
  });
}

export function createInlineMarkInputRulesFromSchema(schema: Schema) {
  const { strong, em, code, strike } = schema.marks;
  return [
    markInputRule(INPUT_RULE_PATTERNS.strong, strong, inlineOnly),
    markInputRule(INPUT_RULE_PATTERNS.strike, strike, canApplyStrikeInput),
    markInputRule(INPUT_RULE_PATTERNS.em, em, canApplyEmInput),
    markInputRule(/_([^_\n]+)_$/, em, canApplyEmInput),
    markInputRule(INPUT_RULE_PATTERNS.code, code, inlineOnly),
    linkInputRule(schema),
  ];
}
