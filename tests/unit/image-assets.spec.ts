import { describe, it, expect } from "vitest";
import { assetRelativePath } from "../../src/lib/image-assets";

describe("assetRelativePath", () => {
  it("returns ./assets/filename for sibling assets dir", () => {
    expect(assetRelativePath("/docs/note.md", "/docs/assets/paste.png")).toBe("./assets/paste.png");
  });
});
