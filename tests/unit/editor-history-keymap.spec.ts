import { describe, it, expect } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { markdownSchema } from "@/editor/schema";
import { createEditorPlugins } from "@/editor/plugins";
import { serializeMarkdown } from "@/editor/markdown-serializer";

describe("editor history keymap", () => {
  it("undoes and redoes edits with macOS command shortcuts", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.insertText(" world", 6, 6));

    expect(serializeMarkdown(view.state.doc)).toBe("Hello world");

    const undoHandled = view.someProp("handleKeyDown", (handler) =>
      handler(view, new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true, cancelable: true })),
    );

    expect(undoHandled).toBe(true);
    expect(serializeMarkdown(view.state.doc)).toBe("Hello");

    const redoHandled = view.someProp("handleKeyDown", (handler) =>
      handler(
        view,
        new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true, bubbles: true, cancelable: true }),
      ),
    );

    expect(redoHandled).toBe(true);
    expect(serializeMarkdown(view.state.doc)).toBe("Hello world");

    view.destroy();
    document.body.removeChild(mount);
  });
});
