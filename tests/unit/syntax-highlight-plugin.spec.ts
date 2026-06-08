import { describe, it, expect, vi, afterEach } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { collectCodeBlocksForHighlight } from "@/editor/syntax-highlight/plugin";
import { markdownSchema } from "@/editor/schema";
import { createCodeBlockNodeView } from "@/editor/code-block-view";
import { createSyntaxHighlightPlugin } from "@/editor/syntax-highlight/plugin";

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

describe("collectCodeBlocksForHighlight", () => {
  it("skips mermaid blocks", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("code_block", { params: "mermaid" }, [markdownSchema.text("graph TD")]),
      markdownSchema.node("code_block", { params: "js" }, [markdownSchema.text("const x = 1")]),
    ]);
    const blocks = collectCodeBlocksForHighlight(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("javascript");
  });

  it("collects non-mermaid blocks without an explicit language for auto highlighting", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("code_block", { params: "" }, [markdownSchema.text("const x = 1")]),
      markdownSchema.node("code_block", { params: "ts" }, [markdownSchema.text("const y = 2")]),
    ]);
    const blocks = collectCodeBlocksForHighlight(doc);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe("plaintext");
    expect(blocks[1].language).toBe("typescript");
  });
});

describe("createCodeBlockNodeView", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function createMockView(state: EditorState) {
    const mockView = {
      state,
      dispatch(tr: import("prosemirror-state").Transaction) {
        mockView.state = mockView.state.apply(tr);
      },
      focus: vi.fn(),
    };
    return mockView as unknown as import("prosemirror-view").EditorView;
  }
  it("does not mark a code block with a language before one is set", () => {
    const node = markdownSchema.node("code_block", { params: "" }, [markdownSchema.text("const x = 1;")]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [node]),
    });
    const nodeView = createCodeBlockNodeView(node, createMockView(state), () => 0);
    const wrapper = nodeView.dom as HTMLElement;

    expect(wrapper.dataset.language).toBeUndefined();
    expect(wrapper.querySelector(".hljs-overlay")).not.toBeNull();
    expect(wrapper.querySelector(".code-block-language-trigger")?.textContent).toBe("plain text");
  });

  it("updates the visible language badge when params are set", () => {
    const node = markdownSchema.node("code_block", { params: "" }, [markdownSchema.text("const x = 1;")]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [node]),
    });
    const nodeView = createCodeBlockNodeView(node, createMockView(state), () => 0);
    const updated = markdownSchema.node("code_block", { params: "ts" }, [markdownSchema.text("const x = 1;")]);
    const wrapper = nodeView.dom as HTMLElement;

    expect(nodeView.update?.(updated)).toBe(true);
    expect(wrapper.dataset.language).toBe("ts");
    expect(wrapper.querySelector(".code-block-language-trigger")?.textContent).toBe("ts");
  });

  it("commits inline language edits from the code block controls", () => {
    const node = markdownSchema.node("code_block", { params: "" }, [markdownSchema.text("const x = 1;")]);
    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [node]),
    });
    const view = createMockView(state);
    const nodeView = createCodeBlockNodeView(node, view, () => 0);
    const wrapper = nodeView.dom as HTMLElement;
    const trigger = wrapper.querySelector(".code-block-language-trigger") as HTMLButtonElement | null;
    const input = wrapper.querySelector(".code-block-language-input") as HTMLInputElement | null;

    expect(trigger).not.toBeNull();
    expect(input).not.toBeNull();
    trigger!.click();
    input!.value = "rust";
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect((view.state.doc.firstChild as import("prosemirror-model").Node).attrs.params).toBe("rust");
    expect(wrapper.dataset.language).toBe("rust");
    expect(trigger!.textContent).toBe("rust");
  });

  it("marks a language-configured block as highlighted once overlay html is ready", () => {
    vi.useFakeTimers();

    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("code_block", { params: "ts" }, [markdownSchema.text("const x = 1;")]),
      ]),
      plugins: [createSyntaxHighlightPlugin()],
    });

    const view = new EditorView(mount, {
      state,
      nodeViews: {
        code_block: createCodeBlockNodeView,
      },
    });

    const wrapper = mount.querySelector(".code-block-wrapper") as HTMLElement | null;
    expect(wrapper?.dataset.highlighted).toBeUndefined();

    vi.advanceTimersByTime(200);

    expect(wrapper?.dataset.highlighted).toBe("true");
    expect(wrapper?.querySelector(".hljs-overlay code")?.className).toContain("hljs");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("marks a language-empty block as highlighted once auto-detected overlay html is ready", () => {
    vi.useFakeTimers();

    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("code_block", { params: "" }, [markdownSchema.text("const x = 1;")]),
      ]),
      plugins: [createSyntaxHighlightPlugin()],
    });

    const view = new EditorView(mount, {
      state,
      nodeViews: {
        code_block: createCodeBlockNodeView,
      },
    });

    vi.advanceTimersByTime(200);

    const wrapper = mount.querySelector(".code-block-wrapper") as HTMLElement | null;
    expect(wrapper?.dataset.highlighted).toBe("true");
    expect(wrapper?.querySelector(".hljs-overlay code")?.className).toContain("hljs");

    view.destroy();
    document.body.removeChild(mount);
  });

  it("refreshes highlighted overlay after typing into a json block", () => {
    vi.useFakeTimers();

    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("code_block", { params: "json" }, [markdownSchema.text("{\n}")]),
      ]),
      plugins: [createSyntaxHighlightPlugin()],
    });

    const view = new EditorView(mount, {
      state,
      nodeViews: {
        code_block: createCodeBlockNodeView,
      },
    });

    vi.advanceTimersByTime(200);

    const wrapper = mount.querySelector(".code-block-wrapper") as HTMLElement | null;
    const codeNode = wrapper?.querySelector("code");
    expect(codeNode).not.toBeNull();
    codeNode?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    typeInto(view, '\n  "a": 1');

    vi.advanceTimersByTime(200);

    const nextOverlay = wrapper?.querySelector(".hljs-overlay")?.innerHTML ?? "";
    expect(wrapper?.dataset.highlighted).toBe("true");
    expect(nextOverlay).toContain("language-json");
    expect(nextOverlay).toContain("hljs");
    expect(nextOverlay).toMatch(/hljs-(attr|number|string|punctuation)/);

    view.destroy();
    document.body.removeChild(mount);
  });
});
