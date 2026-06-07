import { describe, it, expect } from "vitest";
import { createDocumentSession } from "../../src/lib/document-session";

describe("document session", () => {
  it("tracks path, dirty state, and last saved content", () => {
    const session = createDocumentSession({
      id: "doc-1",
      path: "/tmp/note.md",
      content: "# Hello",
    });

    session.markDirty();
    expect(session.isDirty()).toBe(true);
    session.markSaved("# Hello");
    expect(session.isDirty()).toBe(false);
  });
});
