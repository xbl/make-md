import { describe, it, expect } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { markdownSchema } from "../../src/editor/schema";
import { createEditorInputRules } from "../../src/editor/input-rules";
import { createInlineMarkPlugin } from "../../src/editor/inline-mark/plugin";
import { createInlineMarkSyntaxPlugin } from "../../src/editor/inline-mark/syntax-decorations";
import { handleInlineMarkdownPaste } from "../../src/editor/inline-mark/paste";

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

function hasMark(view: EditorView, markName: string): boolean {
  let found = false;
  view.state.doc.descendants((node) => {
    if (node.isText && markdownSchema.marks[markName]?.isInSet(node.marks)) {
      found = true;
    }
  });
  return found;
}

function inlinePlugins() {
  return createInlineMarkPlugin(markdownSchema);
}

describe("inline mark input rules", () => {
  it("converts **bold** while typing", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "**bold**");

    expect(hasMark(view, "strong")).toBe(true);
    expect(view.state.doc.textContent).toBe("bold");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("converts *italic* while typing", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "*italic*");

    expect(hasMark(view, "em")).toBe(true);
    expect(view.state.doc.textContent).toBe("italic");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("allows completing **bold** with spaces after ** ddd *", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "** ddd *");
    expect(view.state.doc.textContent).toBe("** ddd *");

    typeInto(view, "*");
    expect(hasMark(view, "strong")).toBe(true);
    expect(view.state.doc.textContent).toBe(" ddd ");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("allows completing ~~strike~~ with spaces after ~~ ddd ~", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "~~ ddd ~");
    expect(view.state.doc.textContent).toBe("~~ ddd ~");

    typeInto(view, "~");
    expect(hasMark(view, "strike")).toBe(true);
    expect(view.state.doc.textContent).toBe(" ddd ");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("allows completing **bold** after **ddd*", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "**ddd");
    typeInto(view, "*");
    expect(view.state.doc.textContent).toBe("**ddd*");

    typeInto(view, "*");
    expect(hasMark(view, "strong")).toBe(true);
    expect(view.state.doc.textContent).toBe("ddd");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("allows completing ~~strike~~ after ~~ddd~", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "~~ddd");
    typeInto(view, "~");
    expect(view.state.doc.textContent).toBe("~~ddd~");

    typeInto(view, "~");
    expect(hasMark(view, "strike")).toBe(true);
    expect(view.state.doc.textContent).toBe("ddd");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("allows completing marks with full editor input rules (spaced delimiters)", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: [createEditorInputRules(), ...inlinePlugins()],
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "** ddd *");
    typeInto(view, "*");
    expect(hasMark(view, "strong")).toBe(true);

    view.destroy();
    document.body.removeChild(mount);
  });

  it("does not turn ** ddd * into a bullet list when typing space", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: [createEditorInputRules(), ...inlinePlugins()],
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "** ddd *");
    typeInto(view, " ");

    expect(view.state.doc.child(0).type.name).toBe("paragraph");
    expect(view.state.doc.textContent).toBe("** ddd * ");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("converts [text](url) while typing", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "[link](https://example.com)");

    expect(hasMark(view, "link")).toBe(true);
    expect(view.state.doc.textContent).toBe("link");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("converts ~~strike~~ while typing", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "~~strike~~");

    expect(hasMark(view, "strike")).toBe(true);
    expect(view.state.doc.textContent).toBe("strike");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("converts `code` while typing", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: inlinePlugins(),
    });

    const view = new EditorView(mount, { state });
    typeInto(view, "`code`");

    expect(hasMark(view, "code")).toBe(true);
    expect(view.state.doc.textContent).toBe("code");

    view.destroy();
    document.body.removeChild(mount);
  });
});

describe("inline mark paste", () => {
  it("pastes **bold** as a strong mark", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
    });

    const view = new EditorView(mount, { state });
    const handled = handleInlineMarkdownPaste(view, "**bold**");

    expect(handled).toBe(true);
    expect(hasMark(view, "strong")).toBe(true);
    expect(view.state.doc.textContent).toBe("bold");

    view.destroy();
    document.body.removeChild(mount);
  });
});

describe("inline mark syntax decorations", () => {
  it("adds editing decoration when cursor is inside strong", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const paragraph = markdownSchema.nodes.paragraph.create(
      null,
      [markdownSchema.text("bold", [markdownSchema.marks.strong.create()])],
    );
    const doc = markdownSchema.nodes.doc.create(null, [paragraph]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      selection: TextSelection.create(doc, 2),
      plugins: [createInlineMarkSyntaxPlugin()],
    });

    const view = new EditorView(mount, { state });
    const deco = mount.querySelector(".pm-mark-editing--strong");
    expect(deco).not.toBeNull();

    view.destroy();
    document.body.removeChild(mount);
  });

  it("adds editing decoration when cursor is inside code", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const paragraph = markdownSchema.nodes.paragraph.create(
      null,
      [markdownSchema.text("文字", [markdownSchema.marks.code.create()])],
    );
    const doc = markdownSchema.nodes.doc.create(null, [paragraph]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      selection: TextSelection.create(doc, 2),
      plugins: [createInlineMarkSyntaxPlugin()],
    });

    const view = new EditorView(mount, { state });
    const deco = mount.querySelector(".pm-mark-editing--code");
    expect(deco).not.toBeNull();

    view.destroy();
    document.body.removeChild(mount);
  });
});
