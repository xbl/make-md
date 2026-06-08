import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePreferencesStore } from "@/stores/preferences";

vi.mock("@/lib/system-locale", () => ({
  loadSystemLocale: vi.fn(async () => "zh-Hans-CN"),
  syncMenuLocale: vi.fn(async () => {}),
}));

describe("preferences store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads system locale and resolves the effective locale", async () => {
    const store = usePreferencesStore();
    await store.initialize();

    expect(store.languagePreference).toBe("system");
    expect(store.systemLocale).toBe("zh-Hans-CN");
    expect(store.effectiveLocale).toBe("zh-CN");
  });

  it("persists an explicit language preference", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size;
      },
    } satisfies Storage);

    const store = usePreferencesStore();
    await store.initialize();
    await store.setLanguagePreference("en");

    expect(store.effectiveLocale).toBe("en");
    expect(globalThis.localStorage?.getItem("make-md:language")).toBe("en");
  });
});
