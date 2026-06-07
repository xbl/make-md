import { describe, it, expect } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { inputRules } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { markdownSchema } from "../../src/editor/schema";
import { createEditorInputRules } from "../../src/editor/input-rules";
import {
  createCodeBlockInputRules,
  createCodeBlockKeymap,
} from "../../src/editor/code-block-input";

function typeInto(view: EditorView, text: string) {
  for (const char of text) {
    const from = view.state.selection.from;
    const to = view.state.selection.to;
    const handled = view.someProp("handleTextInput", (handler) => handler(view, from, to, char));
    if (!handled) {
      view.dispatch(view.state.tr.insertText(char, from, to));
    }
  }
}

function createView(mount: HTMLElement) {
  const state = EditorState.create({
    schema: markdownSchema,
    doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
    plugins: [
      createEditorInputRules(),
      keymap(createCodeBlockKeymap()),
      keymap(baseKeymap),
    ],
  });
  return new EditorView(mount, { state });
}

describe("code block input", () => {
  it("exits an empty fenced block when typing closing ```", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = createView(mount);

    typeInto(view, "```");
    expect(view.state.selection.$from.parent.type.name).toBe("code_block");

    typeInto(view, "```");
    expect(view.state.selection.$from.parent.type.name).toBe("paragraph");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("inserts a paragraph after a fenced block at document end", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = createView(mount);

    typeInto(view, "```");
    typeInto(view, "line");
    typeInto(view, "\n```");

    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.child(0).type.name).toBe("code_block");
    expect(view.state.doc.child(1).type.name).toBe("paragraph");
    expect(view.state.selection.$from.parent.type.name).toBe("paragraph");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("registers closing fence rule for in-code input", () => {
    expect(createCodeBlockInputRules()).toHaveLength(1);
  });
});
