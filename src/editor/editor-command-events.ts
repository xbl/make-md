import { selectAll, setBlockType, toggleMark } from "prosemirror-commands";
import { Plugin } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import { findMatches } from "@/editor/find-replace";
import { findNextMatch, findReplaceKey } from "@/editor/find-replace-plugin";
import { createEditLinkCommand } from "@/editor/inline-mark/link-command";
import { markdownSchema } from "@/editor/schema";

function applyHeadingCommand(commandId: string, view: import("prosemirror-view").EditorView): boolean {
  const match = /^paragraph\.h([1-6])$/.exec(commandId);
  if (!match) {
    return false;
  }

  const level = Number(match[1]);
  return setBlockType(markdownSchema.nodes.heading, { level })(view.state, view.dispatch, view);
}

function applyParagraphCommand(commandId: string, view: import("prosemirror-view").EditorView): boolean {
  if (commandId !== "paragraph.paragraph") {
    return false;
  }

  return setBlockType(markdownSchema.nodes.paragraph)(view.state, view.dispatch, view);
}

function applyFormatCommand(commandId: string, view: import("prosemirror-view").EditorView): boolean {
  if (commandId === "format.bold") {
    return toggleMark(markdownSchema.marks.strong)(view.state, view.dispatch, view);
  }
  if (commandId === "format.italic") {
    return toggleMark(markdownSchema.marks.em)(view.state, view.dispatch, view);
  }
  if (commandId === "format.strike") {
    return toggleMark(markdownSchema.marks.strike)(view.state, view.dispatch, view);
  }
  if (commandId === "format.inlineCode") {
    return toggleMark(markdownSchema.marks.code)(view.state, view.dispatch, view);
  }
  if (commandId === "format.link") {
    return createEditLinkCommand(markdownSchema)(view.state, view.dispatch, view);
  }
  if (commandId === "format.clear") {
    const { from, to, empty } = view.state.selection;
    if (empty) {
      return false;
    }
    let tr = view.state.tr;
    for (const markType of Object.values(markdownSchema.marks)) {
      tr = tr.removeMark(from, to, markType);
    }
    view.dispatch(tr);
    return true;
  }

  return false;
}

function applySelectionCommand(commandId: string, view: import("prosemirror-view").EditorView): boolean {
  if (commandId === "edit.selectAll") {
    return selectAll(view.state, view.dispatch, view);
  }
  if (commandId === "edit.findNext") {
    const pluginState = findReplaceKey.getState(view.state);
    const query = pluginState?.query ?? "";
    if (!query) {
      return false;
    }
    const options = {
      caseSensitive: pluginState?.caseSensitive ?? false,
      wholeWord: pluginState?.wholeWord ?? false,
    };
    const next = findNextMatch(view.state, query, options, view.state.selection.to + 1)
      ?? findNextMatch(view.state, query, options, 0);
    if (!next) {
      return false;
    }
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, next.from, next.to)).scrollIntoView());
    view.focus();
    return true;
  }
  if (commandId === "edit.findPrevious") {
    const pluginState = findReplaceKey.getState(view.state);
    const query = pluginState?.query ?? "";
    if (!query) {
      return false;
    }
    const options = {
      caseSensitive: pluginState?.caseSensitive ?? false,
      wholeWord: pluginState?.wholeWord ?? false,
    };
    const matches: Array<{ from: number; to: number }> = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.isTextblock) {
        return;
      }
      node.forEach((child, offset) => {
        if (!child.isText || !child.text) {
          return;
        }
        for (const match of findMatches(child.text, query, options)) {
          matches.push({
            from: pos + offset + 1 + match,
            to: pos + offset + 1 + match + query.length,
          });
        }
      });
    });
    const current = view.state.selection.from;
    const previous = [...matches].reverse().find((match) => match.from < current) ?? matches[matches.length - 1];
    if (!previous) {
      return false;
    }
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, previous.from, previous.to)).scrollIntoView(),
    );
    view.focus();
    return true;
  }

  return false;
}

function activeCodeBlock(view: import("prosemirror-view").EditorView) {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "code_block") {
      return {
        node,
        pos: $from.before(depth),
      };
    }
  }
  return null;
}

function promptCodeBlockLanguage(currentLanguage: string): string | null {
  const value = window.prompt("Code block language (leave empty for plain text)", currentLanguage);
  if (value === null) {
    return null;
  }
  return value.trim();
}

function promptPositiveInteger(label: string, fallback: string): number | null {
  const value = window.prompt(label, fallback);
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    window.alert("Table size must be a positive integer");
    return null;
  }

  return Number(trimmed);
}

function createEmptyCell(cellType: typeof markdownSchema.nodes.table_cell | typeof markdownSchema.nodes.table_header) {
  return cellType.createAndFill(null, markdownSchema.nodes.paragraph.createAndFill())!;
}

function buildTableNode(columns: number, rows: number) {
  const headerRow = markdownSchema.nodes.table_row.create(
    null,
    Array.from({ length: columns }, () => createEmptyCell(markdownSchema.nodes.table_header)),
  );
  const bodyRows = Array.from({ length: rows }, () =>
    markdownSchema.nodes.table_row.create(
      null,
      Array.from({ length: columns }, () => createEmptyCell(markdownSchema.nodes.table_cell)),
    ),
  );
  return markdownSchema.nodes.table.create(null, [headerRow, ...bodyRows]);
}

function applyTableCommand(view: import("prosemirror-view").EditorView): boolean {
  const columns = promptPositiveInteger("Table column count", "3");
  if (columns === null) {
    return false;
  }

  const rows = promptPositiveInteger("Table row count", "2");
  if (rows === null) {
    return false;
  }

  const { from, to } = view.state.selection;
  const table = buildTableNode(columns, rows);
  let tr = view.state.tr;
  if (from !== to) {
    tr = tr.deleteRange(from, to);
  }
  const { $from } = tr.selection;
  const insertPos = $from.depth > 0 ? $from.after(1) : tr.selection.to;
  tr = tr.insert(insertPos, table);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function applyCodeFenceCommand(view: import("prosemirror-view").EditorView): boolean {
  const active = activeCodeBlock(view);
  const currentLanguage = active?.node.attrs.params ?? "";
  const language = promptCodeBlockLanguage(currentLanguage);
  if (language === null) {
    return false;
  }

  if (active) {
    const tr = view.state.tr.setNodeMarkup(active.pos, active.node.type, {
      ...active.node.attrs,
      params: language,
    });
    view.dispatch(tr);
    view.focus();
    return true;
  }

  const attrs = language ? { params: language } : { params: "" };
  const applied = setBlockType(markdownSchema.nodes.code_block, attrs)(view.state, view.dispatch, view);
  if (applied) {
    view.focus();
  }
  return applied;
}

export function createEditorCommandEventsPlugin() {
  return new Plugin({
    view(view) {
      function onEditorCommand(event: Event) {
        const detail = (event as CustomEvent<{ commandId?: string }>).detail;
        const commandId = detail?.commandId;
        if (!commandId) {
          return;
        }

        if (applyHeadingCommand(commandId, view)) {
          return;
        }

        if (applyParagraphCommand(commandId, view)) {
          return;
        }

        if (applyFormatCommand(commandId, view)) {
          return;
        }

        if (applySelectionCommand(commandId, view)) {
          return;
        }

        if (commandId === "paragraph.table") {
          void applyTableCommand(view);
          return;
        }

        if (commandId === "paragraph.codeFence") {
          void applyCodeFenceCommand(view);
        }
      }

      window.addEventListener("make-md:editor-command", onEditorCommand as EventListener);

      return {
        destroy() {
          window.removeEventListener("make-md:editor-command", onEditorCommand as EventListener);
        },
      };
    },
  });
}
