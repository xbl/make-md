import { computed, watchEffect } from "vue";
import { setActiveLocale, useTranslationRuntime } from "@/i18n/runtime";
import { usePreferencesStore } from "@/stores/preferences";

export function useI18n() {
  const preferences = usePreferencesStore();
  const runtime = useTranslationRuntime();

  watchEffect(() => {
    setActiveLocale(preferences.effectiveLocale);
  });

  return {
    ...runtime,
    effectiveLocale: computed(() => preferences.effectiveLocale),
  };
}
