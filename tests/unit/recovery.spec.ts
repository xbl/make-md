import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRecoverySnapshot,
  loadRecoverySnapshot,
  saveRecoverySnapshot,
} from "../../src/lib/recovery";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("recovery snapshot", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips snapshot data", async () => {
    await saveRecoverySnapshot("doc-1", "hello");
    expect(await loadRecoverySnapshot("doc-1")).toEqual("hello");
    await clearRecoverySnapshot("doc-1");
    expect(await loadRecoverySnapshot("doc-1")).toBeNull();
  });

  it("falls back safely when localStorage is unavailable", async () => {
    vi.stubGlobal("localStorage", undefined);

    await expect(saveRecoverySnapshot("doc-2", "hello")).resolves.toBeUndefined();
    await expect(loadRecoverySnapshot("doc-2")).resolves.toBeNull();
    await expect(clearRecoverySnapshot("doc-2")).resolves.toBeUndefined();
  });
});
