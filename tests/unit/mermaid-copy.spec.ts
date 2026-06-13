import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import EditorPane from "@/components/EditorPane.vue";
import { useDocumentsStore } from "@/stores/documents";

vi.mock("@/lib/image-helpers", () => ({
  convertSvgToPngBlob: vi.fn(() => Promise.resolve(new Blob(["mock-png"], { type: "image/png" }))),
}));

describe("Mermaid copy diagram as PNG", () => {
  const mockClipboardWrite = vi.fn();

  beforeAll(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      value: {
        write: mockClipboardWrite,
        writeText: vi.fn(),
        readText: vi.fn(),
      },
      writable: true,
    });

    (window as any).ClipboardItem = class ClipboardItem {
      constructor(public data: Record<string, Blob>) {}
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds Copy Diagram as PNG to context menu when right-clicking a ready mermaid preview", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();

    const session = documents.createNewDocument();
    session.markSaved("```mermaid\ngraph TD\nA-->B\n```");

    const wrapper = mount(EditorPane, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();
    await nextTick();

    // Set up a mock container structure in the DOM
    const previewContainer = document.createElement("div");
    previewContainer.className = "mermaid-preview mermaid-preview--ready";
    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.innerHTML = "<rect width='10' height='10'></rect>";
    previewContainer.appendChild(svgEl);
    document.body.appendChild(previewContainer);

    // Get the editor view shell to trigger right click
    const shell = wrapper.find(".editor-view-shell");
    expect(shell.exists()).toBe(true);

    // Simulate right click on the SVG element
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    Object.defineProperty(event, "target", { value: svgEl, enumerable: true });
    
    await shell.element.dispatchEvent(event);
    await nextTick();

    // Verify context menu shows copy png option
    const menu = document.querySelector(".context-menu");
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain("Copy Diagram as PNG");

    // Clean up
    document.body.removeChild(previewContainer);
    wrapper.unmount();
  });

  it("does not add Copy Diagram as PNG when right-clicking non-mermaid elements", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();

    const session = documents.createNewDocument();
    session.markSaved("some paragraph text");

    const wrapper = mount(EditorPane, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();
    await nextTick();

    const shell = wrapper.find(".editor-view-shell");
    expect(shell.exists()).toBe(true);

    const normalDiv = document.createElement("div");
    document.body.appendChild(normalDiv);

    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    Object.defineProperty(event, "target", { value: normalDiv, enumerable: true });
    
    await shell.element.dispatchEvent(event);
    await nextTick();

    const menu = document.querySelector(".context-menu");
    expect(menu).not.toBeNull();
    expect(menu?.textContent).not.toContain("Copy Diagram as PNG");

    document.body.removeChild(normalDiv);
    wrapper.unmount();
  });
});
