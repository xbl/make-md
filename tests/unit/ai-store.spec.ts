import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAiStore } from "@/stores/ai";

describe("ai store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("defaults to deepseek as the active provider", () => {
    const store = useAiStore();
    expect(store.activeProvider).toBe("deepseek");
    expect(store.providers.openai.model).toBeTruthy();
    expect(store.providers.deepseek.model).toBe("deepseek-chat");
  });
});
