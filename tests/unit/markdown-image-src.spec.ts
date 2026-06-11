import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  convertFileSrc: vi.fn((path: string) => `http://asset.localhost/${encodeURI(path)}`),
}));

describe("resolveMarkdownImageDisplaySrc", () => {
  it("converts local markdown image paths to tauri asset urls", async () => {
    const { resolveMarkdownImageDisplaySrc } = await import("@/lib/markdown-image-src");

    expect(
      resolveMarkdownImageDisplaySrc(
        "../概要设计 images/SDSP领域-整体高阶架构设计.png",
        "/Users/blxie/Documents/项目/上海银行/二期/Markdown 文档/概要设计/SDSP 领域-概要设计.md",
      ),
    ).toBe(
      "http://asset.localhost//Users/blxie/Documents/%E9%A1%B9%E7%9B%AE/%E4%B8%8A%E6%B5%B7%E9%93%B6%E8%A1%8C/%E4%BA%8C%E6%9C%9F/Markdown%20%E6%96%87%E6%A1%A3/%E6%A6%82%E8%A6%81%E8%AE%BE%E8%AE%A1%20images/SDSP%E9%A2%86%E5%9F%9F-%E6%95%B4%E4%BD%93%E9%AB%98%E9%98%B6%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1.png",
    );
  });
});
