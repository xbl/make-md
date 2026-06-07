import { setBlockType } from "prosemirror-commands";
import { Plugin } from "prosemirror-state";
import { markdownSchema } from "@/editor/schema";

function applyHeadingCommand(commandId: string, view: import("prosemirror-view").EditorView): boolean {
  const match = /^paragraph\.h([1-6])$/.exec(commandId);
  if (!match) {
    return false;
  }

  const level = Number(match[1]);
  return setBlockType(markdownSchema.nodes.heading, { level })(view.state, view.dispatch, view);
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
