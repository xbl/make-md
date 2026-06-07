import { describe, it, expect } from "vitest";

describe("app scaffold", () => {
  it("exports a mountable root component", async () => {
    const { default: App } = await import("../../src/App.vue");
    expect(App).toBeTruthy();
  });
});
