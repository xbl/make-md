import { Fragment } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import type { Slice } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { markdownSchema } from "@/editor/schema";
import { serializeMarkdown } from "@/editor/markdown-serializer";

function sliceToMarkdownDoc(slice: Slice) {
  const content = slice.content;
  const nodes = content.childCount > 0
    ? Array.from({ length: content.childCount }, (_, index) => content.child(index))
    : [markdownSchema.nodes.paragraph.create()];

  return markdownSchema.nodes.doc.create(null, nodes);
}

function selectionToMarkdown(this: Plugin, slice: Slice, _view: EditorView) {
  return serializeMarkdown(sliceToMarkdownDoc(slice));
}

export function createClipboardPlugin() {
  return new Plugin({
    props: {
      clipboardTextSerializer: selectionToMarkdown,
    },
  });
}
