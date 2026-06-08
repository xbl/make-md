import { en } from "@/i18n/locales/en";
import { zhCN } from "@/i18n/locales/zh-CN";

export const SUPPORTED_LOCALES = ["en", "zh-CN"] as const;
export const DEFAULT_LOCALE = "en" as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LanguagePreference = SupportedLocale | "system";

export const catalogs = {
  en,
  "zh-CN": zhCN,
} as const satisfies Record<SupportedLocale, Record<string, string>>;

type CatalogShape = typeof en;

export type MessageKey = keyof CatalogShape;
