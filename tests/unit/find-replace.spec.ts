import { describe, it, expect } from "vitest";
import { findMatches } from "../../src/editor/find-replace";

describe("findMatches", () => {
  it("finds all case-insensitive occurrences", () => {
    const matches = findMatches("Hello hello", "hello", { caseSensitive: false, wholeWord: false });
    expect(matches).toEqual([0, 6]);
  });

  it("respects whole word option", () => {
    const matches = findMatches("the there", "the", { caseSensitive: false, wholeWord: true });
    expect(matches).toEqual([0]);
  });
});
