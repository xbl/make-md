import { invoke, isTauri } from "@tauri-apps/api/core";
import type { SupportedLocale } from "@/i18n/catalog";

export async function loadSystemLocale() {
  if (!isTauri()) {
    return navigator.language;
  }
  return invoke<string>("get_system_locale");
}

export async function syncMenuLocale(locale: SupportedLocale) {
  if (!isTauri()) {
    return;
  }
  await invoke("sync_menu_locale", { locale });
}
