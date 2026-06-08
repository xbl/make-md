import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createPinia, setActivePinia } from "pinia";
import { markdownSchema } from "@/editor/schema";
import { createEditorPlugins } from "@/editor/plugins";
import { setFindReplaceState } from "@/editor/find-replace-plugin";
import { serializeMarkdown } from "@/editor/markdown-serializer";

describe("editor command events", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
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

  it("does nothing when paragraph.table is canceled at the column prompt", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValueOnce(null);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    const before = view.state.doc.textContent;

    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

    expect(promptSpy).toHaveBeenCalledWith("Table column count", "3");
    expect(view.state.doc.textContent).toBe(before);

    promptSpy.mockRestore();
    view.destroy();
    document.body.removeChild(mount);
  });

  it("alerts and does not mutate the document when paragraph.table gets an invalid column count", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValueOnce("0");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    const before = view.state.doc.textContent;

    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

    expect(alertSpy).toHaveBeenCalledWith("Table size must be a positive integer");
    expect(view.state.doc.textContent).toBe(before);

    alertSpy.mockRestore();
    promptSpy.mockRestore();
    view.destroy();
    document.body.removeChild(mount);
  });

  it("does nothing when paragraph.table is canceled at the row prompt", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValueOnce("3").mockReturnValueOnce(null);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    const before = view.state.doc.textContent;

    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

    expect(promptSpy).toHaveBeenNthCalledWith(1, "Table column count", "3");
    expect(promptSpy).toHaveBeenNthCalledWith(2, "Table row count", "2");
    expect(view.state.doc.textContent).toBe(before);

    promptSpy.mockRestore();
    view.destroy();
    document.body.removeChild(mount);
  });

  it("alerts and does not mutate the document when paragraph.table gets an invalid row count", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValueOnce("3").mockReturnValueOnce("0");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    const before = view.state.doc.textContent;

    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

    expect(promptSpy).toHaveBeenNthCalledWith(1, "Table column count", "3");
    expect(promptSpy).toHaveBeenNthCalledWith(2, "Table row count", "2");
    expect(alertSpy).toHaveBeenCalledWith("Table size must be a positive integer");
    expect(view.state.doc.textContent).toBe(before);

    alertSpy.mockRestore();
    promptSpy.mockRestore();
    view.destroy();
    document.body.removeChild(mount);
  });

  it("inserts a table node when paragraph.table receives valid dimensions", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValueOnce("3").mockReturnValueOnce("2");

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });

    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

    const table = Array.from({ length: view.state.doc.childCount }, (_, index) => view.state.doc.child(index))
      .find((node) => node.type.name === "table");
    expect(promptSpy).toHaveBeenNthCalledWith(1, "Table column count", "3");
    expect(promptSpy).toHaveBeenNthCalledWith(2, "Table row count", "2");
    expect(table?.type.name).toBe("table");
    expect(table?.childCount).toBe(3);
    expect(table?.firstChild?.type.name).toBe("table_row");
    expect(table?.firstChild?.childCount).toBe(3);
    expect(table?.firstChild?.child(0).type.name).toBe("table_header");
    expect(table?.firstChild?.child(0).firstChild?.type.name).toBe("paragraph");
    expect(table?.child(1).type.name).toBe("table_row");
    expect(table?.child(1).childCount).toBe(3);
    expect(table?.child(1).child(0).type.name).toBe("table_cell");
    expect(table?.child(1).child(0).firstChild?.type.name).toBe("paragraph");
    expect(table?.child(2).type.name).toBe("table_row");
    expect(table?.child(2).childCount).toBe(3);
    expect(table?.child(2).child(2).type.name).toBe("table_cell");
    expect(serializeMarkdown(view.state.doc)).toContain("|  |  |  |");
    expect(serializeMarkdown(view.state.doc)).toContain("| --- | --- | --- |");

    promptSpy.mockRestore();
    view.destroy();
    document.body.removeChild(mount);
  });

  it("replaces a non-empty selection with a table node when paragraph.table receives valid dimensions", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValueOnce("2").mockReturnValueOnce("1");

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
        markdownSchema.node("paragraph", null, [markdownSchema.text("World")]),
      ]),
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));

    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

    const children = Array.from({ length: view.state.doc.childCount }, (_, index) => view.state.doc.child(index));
    const table = children.find((node) => node.type.name === "table");
    expect(promptSpy).toHaveBeenNthCalledWith(1, "Table column count", "3");
    expect(promptSpy).toHaveBeenNthCalledWith(2, "Table row count", "2");
    expect(view.state.doc.childCount).toBe(3);
    expect(view.state.doc.firstChild?.type.name).toBe("paragraph");
    expect(view.state.doc.firstChild?.textContent).toBe("");
    expect(table?.type.name).toBe("table");
    expect(table?.childCount).toBe(2);
    expect(table?.firstChild?.childCount).toBe(2);
    expect(table?.child(1).childCount).toBe(2);
    expect(serializeMarkdown(view.state.doc)).toContain("|  |  |");
    expect(serializeMarkdown(view.state.doc)).not.toContain("Hello");
    expect(serializeMarkdown(view.state.doc)).toContain("World");

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
