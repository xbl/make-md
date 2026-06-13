import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { convertSvgToPngBlob } from "@/lib/image-helpers";

describe("convertSvgToPngBlob", () => {
  let originalImage: typeof globalThis.Image;
  let originalURL: typeof globalThis.URL;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    originalImage = globalThis.Image;
    originalURL = globalThis.URL;
    originalCreateElement = document.createElement;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: originalImage,
    });
    document.createElement = originalCreateElement;
    vi.restoreAllMocks();
  });

  it("converts svg to png blob successfully", async () => {
    class FakeImage {
      naturalWidth = 120;
      naturalHeight = 60;
      width = 120;
      height = 60;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: FakeImage,
    });

    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      })),
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
        cb(new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }));
      }),
    };

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "canvas") {
        return fakeCanvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement.call(document, tagName);
    }) as typeof document.createElement);

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#fff"/></svg>';
    const pngBlob = await convertSvgToPngBlob(svg);

    expect(pngBlob).toBeInstanceOf(Blob);
    expect(pngBlob.type).toBe("image/png");
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(fakeCanvas.width).toBe(120);
    expect(fakeCanvas.height).toBe(60);
  });

  it("throws an error when image loading fails", async () => {
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: ((err: any) => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.(new Error("Failed to load SVG image")));
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: FailingImage,
    });

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#fff"/></svg>';
    await expect(convertSvgToPngBlob(svg)).rejects.toThrow("Failed to load SVG image");
  });

  it("throws an error if canvas context is unavailable", async () => {
    class FakeImage {
      naturalWidth = 120;
      naturalHeight = 60;
      width = 120;
      height = 60;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: FakeImage,
    });

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => null), // unavailable context
    };

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "canvas") {
        return fakeCanvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement.call(document, tagName);
    }) as typeof document.createElement);

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#fff"/></svg>';
    await expect(convertSvgToPngBlob(svg)).rejects.toThrow("Canvas context is unavailable");
  });
});
