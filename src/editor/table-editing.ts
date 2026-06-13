import type { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { markdownSchema } from "@/editor/schema";

export type TableOverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ActiveTableContext = {
  tablePos: number;
  rowIndex: number;
  columnIndex: number;
  rowCount: number;
  columnCount: number;
  rect: TableOverlayRect;
};

export type TableAction =
  | "insert-column-left"
  | "insert-column-right"
  | "remove-column"
  | "insert-row-above"
  | "insert-row-below"
  | "remove-row";

export function getActiveTableContext(
  view: EditorView,
  container: HTMLElement,
): ActiveTableContext | null {
  const { $from, empty } = view.state.selection;
  if (!empty) {
    return null;
  }

  let cellNode: PMNode | null = null;
  let rowNode: PMNode | null = null;
  let tablePos = -1;
  let tableNode: PMNode | null = null;

  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "table_cell" || node.type.name === "table_header") {
      cellNode = node;
    } else if (node.type.name === "table_row") {
      rowNode = node;
    } else if (node.type.name === "table") {
      tablePos = $from.before(depth);
      tableNode = node;
      break;
    }
  }

  if (!cellNode || !rowNode || !tableNode || tablePos === -1) {
    return null;
  }

  const rowCount = tableNode.childCount;
  const columnCount = tableNode.firstChild?.childCount ?? 0;

  let rowIndex = -1;
  tableNode.forEach((child, _offset, index) => {
    if (child === rowNode) {
      rowIndex = index;
    }
  });

  let columnIndex = -1;
  rowNode.forEach((child, _offset, index) => {
    if (child === cellNode) {
      columnIndex = index;
    }
  });

  if (rowIndex === -1 || columnIndex === -1) {
    return null;
  }

  const tableDom = view.nodeDOM(tablePos) as HTMLElement | null;
  const tableRect = tableDom
    ? tableDom.getBoundingClientRect()
    : { left: 0, top: 0, width: 0, height: 0 };
  const containerRect = container.getBoundingClientRect();

  const rect: TableOverlayRect = {
    left: tableRect.left - containerRect.left,
    top: tableRect.top - containerRect.top,
    width: tableRect.width,
    height: tableRect.height,
  };

  return {
    tablePos,
    rowIndex,
    columnIndex,
    rowCount,
    columnCount,
    rect,
  };
}

export function applyTableAction(
  view: EditorView,
  action: TableAction,
  context: ActiveTableContext,
): boolean {
  const tableNode = view.state.doc.nodeAt(context.tablePos);
  if (!tableNode || tableNode.type.name !== "table") {
    return false;
  }

  const rows: PMNode[] = [];
  tableNode.forEach((child) => {
    rows.push(child);
  });

  const createEmptyCell = (type: typeof markdownSchema.nodes.table_cell | typeof markdownSchema.nodes.table_header) => {
    return type.createAndFill(null, markdownSchema.nodes.paragraph.createAndFill())!;
  };

  let newRows: PMNode[] = [];

  switch (action) {
    case "insert-row-above": {
      const cells = Array.from({ length: context.columnCount }, () =>
        createEmptyCell(markdownSchema.nodes.table_cell),
      );
      const newRow = markdownSchema.nodes.table_row.create(null, cells);
      newRows = [...rows];
      newRows.splice(context.rowIndex, 0, newRow);
      break;
    }
    case "insert-row-below": {
      const cells = Array.from({ length: context.columnCount }, () =>
        createEmptyCell(markdownSchema.nodes.table_cell),
      );
      const newRow = markdownSchema.nodes.table_row.create(null, cells);
      newRows = [...rows];
      newRows.splice(context.rowIndex + 1, 0, newRow);
      break;
    }
    case "remove-row": {
      if (context.rowCount <= 1) {
        return false;
      }
      newRows = [...rows];
      newRows.splice(context.rowIndex, 1);
      break;
    }
    case "insert-column-left": {
      newRows = rows.map((row, r) => {
        const cells: PMNode[] = [];
        row.forEach((cell) => {
          cells.push(cell);
        });
        const cellType = r === 0 ? markdownSchema.nodes.table_header : markdownSchema.nodes.table_cell;
        cells.splice(context.columnIndex, 0, createEmptyCell(cellType));
        return markdownSchema.nodes.table_row.create(null, cells);
      });
      break;
    }
    case "insert-column-right": {
      newRows = rows.map((row, r) => {
        const cells: PMNode[] = [];
        row.forEach((cell) => {
          cells.push(cell);
        });
        const cellType = r === 0 ? markdownSchema.nodes.table_header : markdownSchema.nodes.table_cell;
        cells.splice(context.columnIndex + 1, 0, createEmptyCell(cellType));
        return markdownSchema.nodes.table_row.create(null, cells);
      });
      break;
    }
    case "remove-column": {
      if (context.columnCount <= 1) {
        return false;
      }
      newRows = rows.map((row) => {
        const cells: PMNode[] = [];
        row.forEach((cell) => {
          cells.push(cell);
        });
        cells.splice(context.columnIndex, 1);
        return markdownSchema.nodes.table_row.create(null, cells);
      });
      break;
    }
    default:
      return false;
  }

  const newTable = markdownSchema.nodes.table.create(null, newRows);
  const tr = view.state.tr.replaceWith(
    context.tablePos,
    context.tablePos + tableNode.nodeSize,
    newTable,
  );
  view.dispatch(tr);
  return true;
}