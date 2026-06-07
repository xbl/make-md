import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { extractOutline } from "../../src/lib/outline";
import { useEditorStore } from "../../src/stores/editor";
import { useDocumentsStore } from "../../src/stores/documents";

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

  it("creates a new untitled document and activates it", () => {
    const documents = useDocumentsStore();
    const session = documents.createNewDocument();

    expect(documents.activeSessionId).toBe(session.id);
    expect(documents.activeSession?.path).toBe("");
    expect(documents.activeSession?.content).toBe("");
    expect(documents.sessions).toHaveLength(1);
  });
});
