import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from "prosemirror-inputrules";
import type { NodeType } from "prosemirror-model";
import { markdownSchema } from "@/editor/schema";
import { createCodeBlockInputRules } from "@/editor/code-block-input";

function blockInputRule(
  regexp: RegExp,
  nodeType: NodeType,
  getAttrs?: (match: RegExpMatchArray) => Record<string, unknown> | null,
) {
  return textblockTypeInputRule(regexp, nodeType, getAttrs);
}

export function createEditorInputRules() {
  const {
    heading,
    blockquote,
    bullet_list,
    ordered_list,
    code_block,
    horizontal_rule,
    task_list,
    task_item,
    paragraph,
  } = markdownSchema.nodes;

  return inputRules({
    rules: [
      ...createCodeBlockInputRules(),
      blockInputRule(/^(#{1,6})\s$/, heading, (match) => ({
        level: match[1].length,
      })),
      wrappingInputRule(/^\s*>\s$/, blockquote),
      wrappingInputRule(/^\s*([-+*])\s$/, bullet_list),
      wrappingInputRule(/^(\d+)\.\s$/, ordered_list, (match) => ({
        order: Number(match[1]),
      })),
      new InputRule(/^```([a-zA-Z0-9+#.-]*)$/, (state, match, start, end) => {
        const params = match[1] ?? "";
        const tr = state.tr.delete(start, end);
        return tr.setBlockType(start, start, code_block, params ? { params } : null);
      }),
      new InputRule(/^(-{3,}|\*{3,}|_{3,})$/, (state, _match, start, end) => {
        const $start = state.doc.resolve(start);
        return state.tr.replaceWith($start.before(), $start.after(), horizontal_rule.create());
      }),
      new InputRule(/^\s*([-+*])\s+\[([ xX])\]\s$/, (state, match, start, end) => {
        void end;
        const checked = match[2].toLowerCase() === "x";
        const $start = state.doc.resolve(start);
        const item = task_item.create({ checked }, paragraph.create());
        const list = task_list.create(null, [item]);
        return state.tr.replaceWith($start.before(), $start.after(), list);
      }),
    ],
  });
}
