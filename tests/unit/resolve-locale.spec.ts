import { describe, expect, it } from "vitest";
import { normalizeSystemLocale, resolveEffectiveLocale } from "@/i18n/resolve-locale";

describe("resolve locale", () => {
  it("normalizes supported and fallback locales", () => {
    expect(normalizeSystemLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(normalizeSystemLocale("zh-Hans-SG")).toBe("zh-CN");
    expect(normalizeSystemLocale("en-GB")).toBe("en");
    expect(normalizeSystemLocale("fr-FR")).toBe("en");
  });

  it("prefers the explicit preference over the system locale", () => {
    expect(resolveEffectiveLocale("zh-CN", "en-US")).toBe("zh-CN");
    expect(resolveEffectiveLocale("en", "zh-CN")).toBe("en");
    expect(resolveEffectiveLocale("system", "zh-Hans-CN")).toBe("zh-CN");
  });
});
