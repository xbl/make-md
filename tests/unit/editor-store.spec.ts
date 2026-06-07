import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { extractOutline } from "../../src/lib/outline";
import { useEditorStore } from "../../src/stores/editor";

describe("editor store outline bridge", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("extracts outline from parsed markdown without a live view", () => {
    const doc = parseMarkdown("# Alpha\n\n## Beta");
    const items = extractOutline(doc);
    expect(items.map((item) => item.text)).toEqual(["Alpha", "Beta"]);
  });

  it("tracks doc version bumps", () => {
    const store = useEditorStore();
    expect(store.docVersion).toBe(0);
    store.bumpDocVersion();
    expect(store.docVersion).toBe(1);
  });
});
