import { describe, it, expect } from "vitest";
import { createAutosaveQueue } from "../../src/lib/autosave";

describe("autosave queue", () => {
  it("coalesces rapid edits into one pending save", async () => {
    const writes: string[] = [];
    const queue = createAutosaveQueue(async (content) => {
      writes.push(content);
    });

    queue.schedule("first");
    queue.schedule("second");
    await queue.flush();

    expect(writes).toEqual(["second"]);
  });
});
