import { describe, it, expect, vi, afterEach } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { collectCodeBlocksForHighlight } from "@/editor/syntax-highlight/plugin";
import { markdownSchema } from "@/editor/schema";
import { createCodeBlockNodeView } from "@/editor/code-block-view";
import { createSyntaxHighlightPlugin } from "@/editor/syntax-highlight/plugin";

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

  it("skips blocks without an explicit language", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("code_block", { params: "" }, [markdownSchema.text("const x = 1")]),
      markdownSchema.node("code_block", { params: "ts" }, [markdownSchema.text("const y = 2")]),
    ]);
    const blocks = collectCodeBlocksForHighlight(doc);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("typescript");
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
});
