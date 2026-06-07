import { describe, it, expect } from "vitest";
import { resolveModECommand } from "@/lib/shortcuts/context";

describe("resolveModECommand", () => {
  it("routes to inline code when selection non-empty", () => {
    expect(
      resolveModECommand({ editorFocused: true, hasSelection: true, inInlineMark: false }),
    ).toBe("format.inlineCode");
  });

  it("routes to export when editor focused without selection", () => {
    expect(
      resolveModECommand({ editorFocused: true, hasSelection: false, inInlineMark: false }),
    ).toBe("export.html");
  });
});
