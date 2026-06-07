import { describe, it, expect, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { markdownSchema } from "@/editor/schema";
import { createEditorPlugins } from "@/editor/plugins";

describe("editor command events", () => {
  it("converts a paragraph to heading 2 when paragraph.h2 is dispatched", async () => {
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
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.h2" } }));

    expect(view.state.doc.firstChild?.type.name).toBe("heading");
    expect(view.state.doc.firstChild?.attrs.level).toBe(2);

    view.destroy();
    document.body.removeChild(mount);
  });

  it("creates a code block with prompted language when paragraph.codeFence is dispatched", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("ts");

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("const x = 1;")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.codeFence" } }));

    expect(promptSpy).toHaveBeenCalledWith("Code block language (leave empty for plain text)", "");
    expect(view.state.doc.firstChild?.type.name).toBe("code_block");
    expect(view.state.doc.firstChild?.attrs.params).toBe("ts");

    promptSpy.mockRestore();
    view.destroy();
    document.body.removeChild(mount);
  });

  it("updates code block language when paragraph.codeFence is dispatched inside an existing code block", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("python");

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("code_block", { params: "ts" }, [markdownSchema.text("const x = 1;")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.codeFence" } }));

    expect(promptSpy).toHaveBeenCalledWith("Code block language (leave empty for plain text)", "ts");
    expect(view.state.doc.firstChild?.type.name).toBe("code_block");
    expect(view.state.doc.firstChild?.attrs.params).toBe("python");

    promptSpy.mockRestore();
    view.destroy();
    document.body.removeChild(mount);
  });
});
