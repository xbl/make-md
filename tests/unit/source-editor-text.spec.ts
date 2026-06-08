import { describe, expect, it } from "vitest";
import {
  indentSelectedLines,
  outdentSelectedLines,
  findNextTextMatch,
  findPreviousTextMatch,
} from "@/lib/source-editor-text";

describe("source editor text helpers", () => {
  it("indents all selected lines", () => {
    expect(indentSelectedLines("alpha\nbeta", 0, 10)).toEqual({
      value: "  alpha\n  beta",
      selectionStart: 2,
      selectionEnd: 14,
    });
  });

  it("outdents all selected lines that start with two spaces", () => {
    expect(outdentSelectedLines("  alpha\n  beta", 0, 14)).toEqual({
      value: "alpha\nbeta",
      selectionStart: 0,
      selectionEnd: 10,
    });
  });

  it("finds the next text match with wraparound support", () => {
    expect(findNextTextMatch("alpha beta alpha", "alpha", { caseSensitive: false, wholeWord: false }, 6)).toEqual({
      from: 11,
      to: 16,
    });
  });

  it("finds the previous text match with wraparound support", () => {
    expect(findPreviousTextMatch("alpha beta alpha", "alpha", { caseSensitive: false, wholeWord: false }, 11)).toEqual({
      from: 0,
      to: 5,
    });
  });
});
