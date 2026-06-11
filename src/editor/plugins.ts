import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { createEditorInputRules } from "@/editor/input-rules";
import { createFindReplacePlugin } from "@/editor/find-replace-plugin";
import { createMermaidPlugin } from "@/editor/mermaid-plugin";
import { createInlineMarkPlugin } from "@/editor/inline-mark/plugin";
import { markdownSchema } from "@/editor/schema";
import { createImageAssetPlugin } from "@/lib/image-asset-plugin";
import {
  createCodeBlockKeymap,
  createCodeBlockPlugin,
} from "@/editor/code-block-input";
import { createSyntaxHighlightPlugin } from "@/editor/syntax-highlight/plugin";
import { createInlineCodeDecorationsPlugin } from "@/editor/inline-code-decorations";
import { createEditorCommandEventsPlugin } from "@/editor/editor-command-events";
import { createClipboardPlugin } from "@/editor/clipboard";
import { createMarkdownPastePlugin } from "@/editor/markdown-paste";

type PluginOptions = {
  getDocPath?: () => string | undefined;
  onImageError?: (message: string) => void;
};

export function createEditorPlugins(options: PluginOptions = {}) {
  const plugins = [
    createEditorInputRules(),
    ...createInlineMarkPlugin(markdownSchema),
    createMermaidPlugin(),
    createFindReplacePlugin(),
    createCodeBlockPlugin(),
    createEditorCommandEventsPlugin(),
    createClipboardPlugin(),
    createMarkdownPastePlugin({
      getDocPath: options.getDocPath,
    }),
    createSyntaxHighlightPlugin(),
    createInlineCodeDecorationsPlugin(),
    history(),
    keymap({
      "Mod-z": undo,
      "Meta-z": undo,
      "Shift-Mod-z": redo,
      "Shift-Meta-z": redo,
      "Mod-y": redo,
      "Meta-y": redo,
    }),
    keymap(createCodeBlockKeymap()),
    keymap(baseKeymap),
  ];

  if (options.getDocPath) {
    plugins.splice(
      1,
      0,
      createImageAssetPlugin({
        getDocPath: options.getDocPath,
        onError: options.onImageError ?? (() => {}),
      }),
    );
  }

  return plugins;
}
