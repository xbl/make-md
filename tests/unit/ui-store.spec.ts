import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui";

describe("useUiStore", () => {
  it("falls back safely when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    setActivePinia(createPinia());

    expect(() => useUiStore()).not.toThrow();

    const store = useUiStore();
    expect(store.theme).toBe("light");
    expect(() => store.toggleTheme()).not.toThrow();
  });

  it("defaults sidebar to collapsed (hidden)", () => {
    vi.stubGlobal("localStorage", undefined);
    setActivePinia(createPinia());
    const store = useUiStore();
    expect(store.sidebarCollapsed).toBe(true);
  });
});
