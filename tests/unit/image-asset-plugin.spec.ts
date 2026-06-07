import { describe, expect, it, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { markdownSchema } from "../../src/editor/schema";
import { createImageAssetPlugin } from "../../src/lib/image-asset-plugin";

describe("image asset paste plugin", () => {
  it("ignores non-image clipboard data for unsaved documents", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const onError = vi.fn();
    const plugin = createImageAssetPlugin({
      getDocPath: () => undefined,
      onError,
    });
    const state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.nodes.doc.create(null, [markdownSchema.nodes.paragraph.create()]),
      plugins: [plugin],
    });
    const view = new EditorView(mount, { state });

    const handled = plugin.props.handlePaste?.(
      view,
      {
        clipboardData: {
          items: [{ type: "text/plain" }],
        },
      } as ClipboardEvent,
    );

    expect(handled).toBe(false);
    expect(onError).not.toHaveBeenCalled();

    view.destroy();
    document.body.removeChild(mount);
  });
});
