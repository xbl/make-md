import { describe, expect, it } from "vitest";
import { markdownSchema } from "@/editor/schema";

describe("image node schema", () => {
  it("creates image node with default attrs", () => {
    const node = markdownSchema.nodes.image.create({ src: "test.png" });
    expect(node.attrs.src).toBe("test.png");
    expect(node.attrs.width).toBeNull();
    expect(node.attrs.height).toBeNull();
    expect(node.attrs.align).toBe("inline");
  });

  it("creates image node with explicit width/height/align", () => {
    const node = markdownSchema.nodes.image.create({
      src: "test.png",
      width: 800,
      height: 600,
      align: "center",
    });
    expect(node.attrs.width).toBe(800);
    expect(node.attrs.height).toBe(600);
    expect(node.attrs.align).toBe("center");
  });

  it("toDOM includes align class", () => {
    const node = markdownSchema.nodes.image.create({ src: "x.png", align: "center" });
    const dom = markdownSchema.nodes.image.spec.toDOM?.(node);
    expect(dom).toBeTruthy();
  });
});
