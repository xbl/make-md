import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { markdownSchema } from "../../src/editor/schema";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { createMermaidPlugin } from "../../src/editor/mermaid-plugin";

const renderMock = vi.fn(async (_id: string, _source: string) => ({
  svg: '<svg data-testid="mermaid-svg"></svg>',
  bindFunctions: undefined,
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: (...args: unknown[]) => renderMock(...args),
  },
}));

describe("mermaid plugin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renderMock.mockClear();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        private callback: IntersectionObserverCallback;
        observe() {
          this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this);
        }
        disconnect() {}
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
        }
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders mermaid blocks into svg preview below the code block", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const doc = parseMarkdown("```mermaid\ngraph TD\n  A-->B\n```");
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: [createMermaidPlugin()],
    });

    const view = new EditorView(mount, { state });

    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    const preview = mount.querySelector(".mermaid-preview");
    expect(preview).not.toBeNull();
    expect(renderMock).toHaveBeenCalled();
    expect(preview?.querySelector('[data-testid="mermaid-svg"]')).not.toBeNull();
    expect(preview?.classList.contains("mermaid-preview--ready")).toBe(true);

    view.destroy();
    document.body.removeChild(mount);
  });

  it("accepts mermaid language case-insensitively", async () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const doc = parseMarkdown("```Mermaid\ngraph TD\n  A-->B\n```");
    const state = EditorState.create({
      schema: markdownSchema,
      doc,
      plugins: [createMermaidPlugin()],
    });

    const view = new EditorView(mount, { state });

    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    expect(renderMock).toHaveBeenCalled();
    expect(mount.querySelector(".mermaid-preview--ready")).not.toBeNull();

    view.destroy();
    document.body.removeChild(mount);
  });
});
