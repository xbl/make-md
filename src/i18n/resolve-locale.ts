import type { LanguagePreference, SupportedLocale } from "@/i18n/catalog";

export function normalizeSystemLocale(locale: string | null | undefined): SupportedLocale {
  const value = (locale ?? "").trim().toLowerCase();
  if (value.startsWith("zh")) {
    return "zh-CN";
  }
  if (value.startsWith("en")) {
    return "en";
  }
  return "en";
}

export function resolveEffectiveLocale(
  preference: LanguagePreference,
  systemLocale: string | null | undefined,
): SupportedLocale {
  if (preference !== "system") {
    return preference;
  }
  return normalizeSystemLocale(systemLocale);
}
