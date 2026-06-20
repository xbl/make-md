import { describe, it, expect } from "vitest";
import { findMatches } from "../../src/editor/find-replace";
import { EditorState } from "prosemirror-state";
import { markdownSchema } from "@/editor/schema";
import { findNextMatch } from "@/editor/find-replace-plugin";

describe("findMatches", () => {
  it("finds all case-insensitive occurrences", () => {
    const matches = findMatches("Hello hello", "hello", { caseSensitive: false, wholeWord: false });
    expect(matches).toEqual([0, 6]);
  });

  it("respects whole word option", () => {
    const matches = findMatches("the there", "the", { caseSensitive: false, wholeWord: true });
    expect(matches).toEqual([0]);
  });

  it("finds matches that cross inline mark boundaries in a text block", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("paragraph", null, [
        markdownSchema.text("al", [markdownSchema.marks.strong.create()]),
        markdownSchema.text("pha"),
      ]),
    ]);
    const state = EditorState.create({ schema: markdownSchema, doc });

    expect(findNextMatch(state, "alpha", { caseSensitive: false, wholeWord: false }, 0)).toEqual({
      from: 1,
      to: 6,
    });
  });

  it("finds the next match after a cross-boundary match", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("paragraph", null, [
        markdownSchema.text("al", [markdownSchema.marks.strong.create()]),
        markdownSchema.text("pha beta alpha"),
      ]),
    ]);
    const state = EditorState.create({ schema: markdownSchema, doc });

    expect(findNextMatch(state, "alpha", { caseSensitive: false, wholeWord: false }, 7)).toEqual({
      from: 12,
      to: 17,
    });
  });
});
