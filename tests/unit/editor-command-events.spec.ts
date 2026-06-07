import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createPinia, setActivePinia } from "pinia";
import { markdownSchema } from "@/editor/schema";
import { createEditorPlugins } from "@/editor/plugins";
import { setFindReplaceState } from "@/editor/find-replace-plugin";

describe("editor command events", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

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

  it("converts a heading back to paragraph when paragraph.paragraph is dispatched", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("heading", { level: 2 }, [markdownSchema.text("Hello")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.paragraph" } }));

    expect(view.state.doc.firstChild?.type.name).toBe("paragraph");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("toggles bold on the current selection when format.bold is dispatched", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
      ]),
      selection: undefined,
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "format.bold" } }));

    const firstText = view.state.doc.firstChild?.firstChild;
    expect(firstText?.marks.some((mark) => mark.type.name === "strong")).toBe(true);

    view.destroy();
    document.body.removeChild(mount);
  });

  it("selects the whole document when edit.selectAll is dispatched", () => {
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
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "edit.selectAll" } }));

    expect(view.state.selection.from).toBe(0);
    expect(view.state.selection.to).toBe(view.state.doc.content.size);

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

  it("adds a link mark to the current selection when format.link is dispatched", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("https://example.com");

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "format.link" } }));

    const firstText = view.state.doc.firstChild?.firstChild;
    const linkMark = firstText?.marks.find((mark) => mark.type.name === "link");
    expect(promptSpy).toHaveBeenCalledWith("Link URL", "https://");
    expect(linkMark?.attrs.href).toBe("https://example.com");

    promptSpy.mockRestore();
    view.destroy();
    document.body.removeChild(mount);
  });

  it("toggles strikethrough on the current selection when format.strike is dispatched", () => {
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
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "format.strike" } }));

    const firstText = view.state.doc.firstChild?.firstChild;
    expect(firstText?.marks.some((mark) => mark.type.name === "strike")).toBe(true);

    view.destroy();
    document.body.removeChild(mount);
  });

  it("clears inline marks from the current selection when format.clear is dispatched", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [
          markdownSchema.text("Hello", [
            markdownSchema.marks.strong.create(),
            markdownSchema.marks.em.create(),
            markdownSchema.marks.strike.create(),
          ]),
        ]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "format.clear" } }));

    const firstText = view.state.doc.firstChild?.firstChild;
    expect(firstText?.marks).toHaveLength(0);

    view.destroy();
    document.body.removeChild(mount);
  });

  it("selects the next match when edit.findNext is dispatched", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("alpha beta alpha")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(setFindReplaceState(view.state, { query: "alpha" }));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 1)));
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "edit.findNext" } }));

    expect(view.state.selection.from).toBe(12);
    expect(view.state.selection.to).toBe(17);

    view.destroy();
    document.body.removeChild(mount);
  });

  it("selects the previous match when edit.findPrevious is dispatched", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("alpha beta alpha")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(setFindReplaceState(view.state, { query: "alpha" }));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 12, 12)));
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "edit.findPrevious" } }));

    expect(view.state.selection.from).toBe(1);
    expect(view.state.selection.to).toBe(6);

    view.destroy();
    document.body.removeChild(mount);
  });
});
