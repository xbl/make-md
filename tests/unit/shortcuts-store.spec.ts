import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useShortcutsStore } from "@/stores/shortcuts";

describe("useShortcutsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
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
});
