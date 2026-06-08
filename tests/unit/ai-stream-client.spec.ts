import { describe, expect, it } from "vitest";
import { startAiStream } from "@/lib/ai/stream-client";

describe("ai stream client", () => {
  it("exports a callable stream starter", () => {
    expect(typeof startAiStream).toBe("function");
  });
});
