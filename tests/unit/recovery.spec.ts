import { describe, it, expect, beforeEach } from "vitest";
import {
  clearRecoverySnapshot,
  loadRecoverySnapshot,
  saveRecoverySnapshot,
} from "../../src/lib/recovery";

describe("recovery snapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips snapshot data", async () => {
    await saveRecoverySnapshot("doc-1", "hello");
    expect(await loadRecoverySnapshot("doc-1")).toEqual("hello");
    await clearRecoverySnapshot("doc-1");
    expect(await loadRecoverySnapshot("doc-1")).toBeNull();
  });
});
