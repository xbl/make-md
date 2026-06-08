import { computed, ref } from "vue";
import { catalogs, DEFAULT_LOCALE, type MessageKey, type SupportedLocale } from "@/i18n/catalog";

const activeLocale = ref<SupportedLocale>(DEFAULT_LOCALE);

export function setActiveLocale(locale: SupportedLocale) {
  activeLocale.value = locale;
}

export function useTranslationRuntime() {
  const locale = computed(() => activeLocale.value);

  function t(key: MessageKey) {
    return catalogs[activeLocale.value][key] ?? catalogs[DEFAULT_LOCALE][key] ?? key;
  }

  return { locale, t };
}
