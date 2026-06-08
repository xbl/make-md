import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { markdownSchema } from "@/editor/schema";
import { createEditorPlugins } from "@/editor/plugins";
import { serializeMarkdown } from "@/editor/markdown-serializer";

describe("editor clipboard serialization", () => {
  it("serializes a full-document selection as markdown text", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("heading", { level: 1 }, [markdownSchema.text("Title")]),
      markdownSchema.node("paragraph", null, [
        markdownSchema.text("Hello "),
        markdownSchema.text("bold", [markdownSchema.marks.strong.create()]),
      ]),
      markdownSchema.node("code_block", { params: "json" }, [markdownSchema.text('{\n  "a": 1\n}')]),
    ]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: createEditorPlugins(),
    });
    const fullSelectionState = state.apply(state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));

    const serializer = fullSelectionState.plugins
      .map((plugin) => plugin.props.clipboardTextSerializer)
      .find((value): value is NonNullable<typeof value> => typeof value === "function");

    expect(serializer).toBeDefined();
    expect(serializer!(fullSelectionState.selection.content(), fullSelectionState)).toBe(serializeMarkdown(doc));
  });
});
