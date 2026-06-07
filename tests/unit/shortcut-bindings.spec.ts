import { describe, it, expect } from "vitest";
import { eventToChord, matchesChord } from "@/lib/shortcuts/bindings";
import { chordToDisplay } from "@/lib/shortcuts/display";

describe("eventToChord", () => {
  it("normalizes mac meta chords", () => {
    const event = new KeyboardEvent("keydown", { key: "b", metaKey: true });
    expect(eventToChord(event)).toBe("Mod-b");
  });

  it("records shift-backtick as Mod-Shift-Backquote", () => {
    const event = new KeyboardEvent("keydown", { key: "`", metaKey: true, shiftKey: true });
    expect(eventToChord(event)).toBe("Mod-Shift-Backquote");
  });
});

describe("matchesChord", () => {
  it("matches equivalent mod chords", () => {
    const event = new KeyboardEvent("keydown", { key: "b", metaKey: true });
    expect(matchesChord(event, "Mod-b")).toBe(true);
  });
});

describe("chordToDisplay", () => {
  it("shows mac symbols", () => {
    expect(chordToDisplay("Mod-Shift-e", "darwin")).toBe("⌘⇧E");
  });
});
