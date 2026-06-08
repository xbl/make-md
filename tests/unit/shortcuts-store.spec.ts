import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useShortcutsStore } from "@/stores/shortcuts";

describe("useShortcutsStore", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects chord conflicts", () => {
    const store = useShortcutsStore();
    const conflict = store.checkConflict("format.bold", "Mod-b");
    expect(conflict).toBeNull();
    store.applyOverride("format.bold", "Mod-k");
    expect(store.checkConflict("format.link", "Mod-k")?.commandId).toBe("format.bold");
  });

  it("returns effective override chords", () => {
    const store = useShortcutsStore();
    store.applyOverride("format.bold", "Mod-Shift-b");
    expect(store.effectiveChord("format.bold")).toBe("Mod-Shift-b");
  });

  it("clears overrides on reset", () => {
    const store = useShortcutsStore();
    store.applyOverride("format.bold", "Mod-Shift-b");
    store.resetCommand("format.bold");
    expect(store.effectiveChord("format.bold")).toBe("Mod-b");
  });

  it("falls back safely when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    setActivePinia(createPinia());

    const store = useShortcutsStore();
    expect(store.effectiveChord("format.bold")).toBe("Mod-b");

    expect(() => store.applyOverride("format.bold", "Mod-Shift-b")).not.toThrow();
    expect(store.effectiveChord("format.bold")).toBe("Mod-Shift-b");
  });
});
