import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { createFindReplacePlugin, findReplaceKey, setFindReplaceState } from "@/editor/find-replace-plugin";
import { markdownSchema } from "@/editor/schema";

describe("find replace plugin decorations", () => {
  it("marks the selected match as active", () => {
    const plugin = createFindReplacePlugin();
    let state = EditorState.create({
      schema: markdownSchema,
      doc: markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("alpha beta alpha")]),
      ]),
      selection: TextSelection.create(
        markdownSchema.node("doc", null, [
          markdownSchema.node("paragraph", null, [markdownSchema.text("alpha beta alpha")]),
        ]),
        12,
        17,
      ),
      plugins: [plugin],
    });

    state = state.apply(setFindReplaceState(state, { query: "alpha" }));

    const pluginState = findReplaceKey.getState(state);
    const decorations = plugin.props.decorations?.(state);
    const found = decorations?.find(1, state.doc.content.size) ?? [];
    const classes = found.map((decoration) => decoration.type.attrs.class);

    expect(pluginState?.query).toBe("alpha");
    expect(classes).toContain("find-match find-match--active");
    expect(classes).toContain("find-match");
  });
});
