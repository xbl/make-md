import { defineStore } from "pinia";
import type { LanguagePreference } from "@/i18n/catalog";
import { resolveEffectiveLocale } from "@/i18n/resolve-locale";
import { loadSystemLocale, syncMenuLocale } from "@/lib/system-locale";

const STORAGE_KEY = "make-md:language";

function getStorage(): Storage | null {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
}

function loadLanguagePreference(): LanguagePreference {
  const value = getStorage()?.getItem(STORAGE_KEY);
  return value === "en" || value === "zh-CN" || value === "system" ? value : "system";
}

function saveLanguagePreference(preference: LanguagePreference) {
  getStorage()?.setItem(STORAGE_KEY, preference);
}

export const usePreferencesStore = defineStore("preferences", {
  state: () => ({
    languagePreference: loadLanguagePreference(),
    systemLocale: "en-US",
  }),
  getters: {
    effectiveLocale(state) {
      return resolveEffectiveLocale(state.languagePreference, state.systemLocale);
    },
  },
  actions: {
    async initialize() {
      this.systemLocale = await loadSystemLocale();
      await syncMenuLocale(this.effectiveLocale);
    },
    async setLanguagePreference(preference: LanguagePreference) {
      this.languagePreference = preference;
      saveLanguagePreference(preference);
      await syncMenuLocale(this.effectiveLocale);
    },
  },
});
