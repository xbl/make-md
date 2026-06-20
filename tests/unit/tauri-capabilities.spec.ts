import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tauri default capability", () => {
  it("allows window destroy so close-request handlers can complete the native close flow", () => {
    const capabilityPath = resolve(process.cwd(), "src-tauri/capabilities/default.json");
    const capability = JSON.parse(readFileSync(capabilityPath, "utf8")) as {
      permissions?: string[];
    };

    expect(capability.permissions).toContain("core:window:allow-destroy");
  });
});
