import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from "prosemirror-inputrules";
import type { NodeType } from "prosemirror-model";
import { markdownSchema } from "@/editor/schema";

function blockInputRule(
  regexp: RegExp,
  nodeType: NodeType,
  getAttrs?: (match: RegExpMatchArray) => Record<string, unknown> | null,
) {
  return textblockTypeInputRule(regexp, nodeType, getAttrs);
}

export function createEditorInputRules() {
  const { heading, blockquote, bullet_list, ordered_list, code_block } = markdownSchema.nodes;

  return inputRules({
    rules: [
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
    ],
  });
}
