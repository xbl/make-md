import { describe, expect, it } from "vitest";
import { createDocumentSession } from "@/lib/document-session";

describe("document session missing flag", () => {
  it("starts not missing", () => {
    const session = createDocumentSession({ id: "/x.md", path: "/x.md", content: "" });
    expect(session.isMissing()).toBe(false);
  });

  it("can be marked missing and back", () => {
    const session = createDocumentSession({ id: "/x.md", path: "/x.md", content: "" });
    session.markMissing(true);
    expect(session.isMissing()).toBe(true);
    session.markMissing(false);
    expect(session.isMissing()).toBe(false);
  });

  it("clears missing on markSaved", () => {
    const session = createDocumentSession({ id: "/x.md", path: "/x.md", content: "" });
    session.markMissing(true);
    session.markSaved("new");
    expect(session.isMissing()).toBe(false);
  });

  it("clears missing on updateContent", () => {
    const session = createDocumentSession({ id: "/x.md", path: "/x.md", content: "" });
    session.markMissing(true);
    session.updateContent("typed");
    expect(session.isMissing()).toBe(false);
  });
});
