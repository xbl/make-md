import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createEditorPlugins } from "@/editor/plugins";
import { markdownSchema } from "@/editor/schema";

describe("markdown paste", () => {
  it("pastes fenced json markdown as a code block", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: createEditorPlugins(),
    });
    const view = new EditorView(mount, { state });

    const handled = view.someProp("handlePaste", (handler) =>
      handler(
        view,
        {
          preventDefault() {},
          clipboardData: {
            items: [{ type: "text/plain" }],
            getData(type: string) {
              return type === "text/plain" ? '```json\n{\n  "a": 1\n}\n```' : "";
            },
          },
        } as ClipboardEvent,
      ),
    );

    expect(handled).toBe(true);
    expect(view.state.doc.childCount).toBe(1);
    expect(view.state.doc.firstChild?.type.name).toBe("code_block");
    expect(view.state.doc.firstChild?.attrs.params).toBe("json");
    expect(view.state.doc.firstChild?.textContent).toContain('"a": 1');

    view.destroy();
    document.body.removeChild(mount);
  });

  it("resolves relative image paths against the active document when pasting structured markdown", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: createEditorPlugins({
        getDocPath: () => "/Users/blxie/Documents/make-md/docs/specs/设计说明.md",
      }),
    });
    const view = new EditorView(mount, { state });

    const handled = view.someProp("handlePaste", (handler) =>
      handler(
        view,
        {
          preventDefault() {},
          clipboardData: {
            items: [{ type: "text/plain" }],
            getData(type: string) {
              return type === "text/plain"
                ? [
                    "# 架构",
                    "",
                    "![架构图](../概要设计 images/image 3.png)",
                  ].join("\n")
                : "";
            },
          },
        } as ClipboardEvent,
      ),
    );

    const image = view.state.doc.child(1)?.firstChild;
    expect(handled).toBe(true);
    expect(image?.type.name).toBe("image");
    expect(image?.attrs.displaySrc).toBe(
      "file:///Users/blxie/Documents/make-md/docs/%E6%A6%82%E8%A6%81%E8%AE%BE%E8%AE%A1%20images/image%203.png",
    );

    view.destroy();
    document.body.removeChild(mount);
  });
});
