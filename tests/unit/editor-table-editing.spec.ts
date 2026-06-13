import { describe, expect, it, vi, beforeEach } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createPinia, setActivePinia } from "pinia";
import { markdownSchema } from "@/editor/schema";
import { createEditorPlugins } from "@/editor/plugins";
import { serializeMarkdown } from "@/editor/markdown-serializer";
import { getActiveTableContext, applyTableAction } from "@/editor/table-editing";

describe("table-editing state extraction and transforms", () => {
  let mount: HTMLDivElement;

  beforeEach(() => {
    setActivePinia(createPinia());
    mount = document.createElement("div");
    document.body.appendChild(mount);
  });

  afterEach(() => {
    document.body.removeChild(mount);
    vi.restoreAllMocks();
  });

  function createEmptyCell(cellType: any) {
    return cellType.createAndFill(null, markdownSchema.nodes.paragraph.createAndFill())!;
  }

  function buildTestTable() {
    const headerRow = markdownSchema.nodes.table_row.create(null, [
      createEmptyCell(markdownSchema.nodes.table_header),
      createEmptyCell(markdownSchema.nodes.table_header),
    ]);
    const bodyRow = markdownSchema.nodes.table_row.create(null, [
      createEmptyCell(markdownSchema.nodes.table_cell),
      createEmptyCell(markdownSchema.nodes.table_cell),
    ]);
    return markdownSchema.nodes.table.create(null, [headerRow, bodyRow]);
  }

  it("extracts active table context when cursor is inside a table", () => {
    const table = buildTestTable();
    const doc = markdownSchema.node("doc", null, [table]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    // Place selection inside the first cell of the second row (body row)
    // Table node is at pos 0, so first cell is inside bodyRow
    // Let's find resolved pos for text or paragraph inside cell
    const pos = 15; // Let's resolve inside first cell of body row
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

    const context = getActiveTableContext(view, mount);
    expect(context).not.toBeNull();
    if (context) {
      expect(context.rowIndex).toBe(1);
      expect(context.columnIndex).toBe(0);
      expect(context.rowCount).toBe(2);
      expect(context.columnCount).toBe(2);
      expect(context.rect).toBeDefined();
    }

    view.destroy();
  });

  it("returns null context when selection is outside table", () => {
    const table = buildTestTable();
    const doc = markdownSchema.node("doc", null, [
      table,
      markdownSchema.node("paragraph", null, [markdownSchema.text("Outside")]),
    ]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    // Place selection inside the outside paragraph
    const pos = view.state.doc.content.size - 2;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));

    const context = getActiveTableContext(view, mount);
    expect(context).toBeNull();

    view.destroy();
  });

  it("inserts row below", () => {
    const table = buildTestTable();
    const doc = markdownSchema.node("doc", null, [table]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 15)));

    const context = getActiveTableContext(view, mount);
    expect(context).not.toBeNull();

    const applied = applyTableAction(view, "insert-row-below", context!);
    expect(applied).toBe(true);

    const updatedTable = view.state.doc.firstChild;
    expect(updatedTable?.childCount).toBe(3); // should have 3 rows now

    view.destroy();
  });

  it("removes row and deletes table on last row removal", () => {
    const table = buildTestTable();
    const doc = markdownSchema.node("doc", null, [table]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 15)));

    let context = getActiveTableContext(view, mount);
    // Remove one row
    let applied = applyTableAction(view, "remove-row", context!);
    expect(applied).toBe(true);
    expect(view.state.doc.firstChild?.childCount).toBe(1);

    // Try to remove the last row (should delete the entire table node)
    context = getActiveTableContext(view, mount);
    expect(context).not.toBeNull();
    applied = applyTableAction(view, "remove-row", context!);
    expect(applied).toBe(true);
    expect(view.state.doc.firstChild?.type.name).not.toBe("table"); // table is gone!

    view.destroy();
  });

  it("inserts column right", () => {
    const table = buildTestTable();
    const doc = markdownSchema.node("doc", null, [table]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 15)));

    const context = getActiveTableContext(view, mount);
    const applied = applyTableAction(view, "insert-column-right", context!);
    expect(applied).toBe(true);

    const updatedTable = view.state.doc.firstChild;
    expect(updatedTable?.firstChild?.childCount).toBe(3); // should have 3 columns in first row

    view.destroy();
  });

  it("removes column and deletes table on last column removal", () => {
    const table = buildTestTable();
    const doc = markdownSchema.node("doc", null, [table]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: createEditorPlugins(),
    });

    const view = new EditorView(mount, { state });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 15)));

    let context = getActiveTableContext(view, mount);
    // Remove one column
    let applied = applyTableAction(view, "remove-column", context!);
    expect(applied).toBe(true);
    expect(view.state.doc.firstChild?.firstChild?.childCount).toBe(1);

    // Try to remove the last column (should delete the entire table node)
    context = getActiveTableContext(view, mount);
    applied = applyTableAction(view, "remove-column", context!);
    expect(applied).toBe(true);
    expect(view.state.doc.firstChild?.type.name).not.toBe("table"); // table is gone!

    view.destroy();
  });
});