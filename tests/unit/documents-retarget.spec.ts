import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { createDocumentSession } from "../../src/lib/document-session";
import { useDocumentsStore } from "../../src/stores/documents";

describe("documents retarget path", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("updates session id and path after rename", () => {
    const store = useDocumentsStore();
    const session = createDocumentSession({
      id: "/tmp/old.md",
      path: "/tmp/old.md",
      content: "# Hi",
    });
    store.openSession(session);
    store.retargetSessionPath("/tmp/old.md", "/tmp/new.md");
    expect(store.activeSession?.path).toBe("/tmp/new.md");
    expect(store.activeSessionId).toBe("/tmp/new.md");
  });
});
