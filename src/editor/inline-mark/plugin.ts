import { Plugin } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import { createInlineMarkTextInputPlugin } from "@/editor/inline-mark/text-input";
import { createInlineMarkKeymap } from "@/editor/inline-mark/keymap";
import { createInlineMarkSyntaxPlugin } from "@/editor/inline-mark/syntax-decorations";
import { handleInlineMarkdownPaste } from "@/editor/inline-mark/paste";

function createInlineMarkPastePlugin() {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        return handleInlineMarkdownPaste(view, text);
      },
    },
  });
}

export function createInlineMarkPlugin(schema: Schema) {
  return [
    createInlineMarkTextInputPlugin(schema),
    createInlineMarkSyntaxPlugin(),
    createInlineMarkKeymap(schema),
    createInlineMarkPastePlugin(),
  ];
}

export { tokenizeInlineMarkdown, containsInlineMarkdown } from "@/editor/inline-mark/syntax";
