import { describe, it, expect } from "vitest";
import { COMMAND_CATALOG, getCommandCatalog, getDefaultChordMap } from "@/lib/shortcuts/registry";

describe("COMMAND_CATALOG", () => {
  it("uses Typora inline code chord", () => {
    const inlineCode = COMMAND_CATALOG.find((command) => command.id === "format.inlineCode");
    expect(inlineCode?.defaultChord).toBe("Mod-Shift-Backquote");
  });

  it("maps export html to Mod-e", () => {
    const exportHtml = COMMAND_CATALOG.find((command) => command.id === "export.html");
    expect(exportHtml?.defaultChord).toBe("Mod-e");
  });

  it("maps bold to Mod-b", () => {
    const bold = COMMAND_CATALOG.find((command) => command.id === "format.bold");
    expect(bold?.defaultChord).toBe("Mod-b");
  });

  it("includes the source toggle command", () => {
    const source = COMMAND_CATALOG.find((command) => command.id === "view.source");
    expect(source?.label).toBe("Toggle Source");
  });

  it("builds default chord map without duplicates for unique commands", () => {
    const map = getDefaultChordMap();
    expect(map["format.bold"]).toBe("Mod-b");
    expect(map["view.sidebar"]).toBe("Mod-Shift-l");
  });

  it("registers AI rewrite selection shortcut", () => {
    const aiRewrite = COMMAND_CATALOG.find((command) => command.id === "view.aiRewriteSelection");
    expect(aiRewrite?.defaultChord).toBe("Mod-Shift-a");
  });

  it("maps replace to Mod-Alt-f to avoid conflicting with macOS hide", () => {
    const replace = COMMAND_CATALOG.find((command) => command.id === "edit.replace");
    expect(replace?.defaultChord).toBe("Mod-Alt-f");
  });

  it("resolves labels by locale without changing ids", () => {
    const zh = getCommandCatalog("zh-CN");
    const open = zh.find((command) => command.id === "file.open");
    expect(open?.label).toBe("打开文件");
  });
});
