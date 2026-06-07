import { InputRule } from "prosemirror-inputrules";
import type { MarkType } from "prosemirror-model";
import type { Schema } from "prosemirror-model";
import { canApplyInlineInput } from "@/editor/inline-mark/guards";
import { INPUT_RULE_PATTERNS } from "@/editor/inline-mark/syntax";

function markInputRule(
  regexp: RegExp,
  markType: MarkType,
  getAttrs?: (match: RegExpMatchArray) => Record<string, unknown> | null,
  textGroup = 1,
): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    if (!canApplyInlineInput(state)) {
      return null;
    }

    const attrs = getAttrs ? getAttrs(match) : null;
    const mark = markType.create(attrs);
    const full = match[0];
    const text = match[textGroup] ?? "";
    if (!text) {
      return null;
    }

    const textStart = start + full.indexOf(text);
    const textEnd = textStart + text.length;
    let tr = state.tr;
    if (textEnd < end) {
      tr = tr.delete(textEnd, end);
    }
    if (start < textStart) {
      tr = tr.delete(start, textStart);
    }

    const from = start;
    const to = start + text.length;
    tr = tr.removeMark(from, to, markType);
    return tr.addMark(from, to, mark);
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

    const textStart = start + full.indexOf(text);
    const textEnd = textStart + text.length;
    let tr = state.tr;
    if (textEnd < end) {
      tr = tr.delete(textEnd, end);
    }
    if (start < textStart) {
      tr = tr.delete(start, textStart);
    }

    const from = start;
    const to = start + text.length;
    const mark = link.create({ href, title: text });
    tr = tr.removeMark(from, to, link);
    return tr.addMark(from, to, mark);
  });
}

export function createInlineMarkInputRulesFromSchema(schema: Schema) {
  const { strong, em, code, strike } = schema.marks;
  return [
    markInputRule(INPUT_RULE_PATTERNS.strong, strong),
    markInputRule(INPUT_RULE_PATTERNS.em, em),
    markInputRule(/_([^_\n]+)_$/, em),
    markInputRule(INPUT_RULE_PATTERNS.strike, strike),
    markInputRule(INPUT_RULE_PATTERNS.code, code),
    linkInputRule(schema),
  ];
}
