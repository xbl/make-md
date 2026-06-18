import { describe, expect, it } from "vitest";
import { webSearch, webFetch } from "@/lib/ai/tools";

describe("ai tools", () => {
  it("webSearch has expected shape", () => {
    expect(webSearch.description).toBeTruthy();
    expect(typeof webSearch.execute).toBe("function");
  });

  it("webFetch has expected shape", () => {
    expect(webFetch.description).toBeTruthy();
    expect(typeof webFetch.execute).toBe("function");
  });
});
