<template>
  <div v-if="ai.settingsOpen" class="settings-panel" data-testid="ai-settings-panel" @click.self="ai.closeSettings()">
    <section class="settings-panel__dialog" aria-label="AI Settings" role="dialog" aria-modal="true">
      <header class="settings-panel__header">
        <div>
          <h2 class="settings-panel__title">AI Settings</h2>
          <p class="settings-panel__subtitle">Configure provider, model, and API access for AI rewriting.</p>
        </div>
        <div class="settings-panel__header-actions">
          <button class="settings-panel__close" type="button" aria-label="Close AI settings" @click="ai.closeSettings()">
            Close
          </button>
        </div>
      </header>

      <div class="settings-panel__list">
        <section class="settings-panel__category">
          <h3 class="settings-panel__category-title">Provider</h3>

          <article class="settings-panel__row">
            <div class="settings-panel__meta">
              <h4 class="settings-panel__command">Active Provider</h4>
              <p class="settings-panel__details">Choose which AI provider to use by default.</p>
            </div>

            <div class="settings-panel__actions">
              <select v-model="ai.activeProvider" class="settings-panel__select">
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
          </article>

          <article class="settings-panel__row" v-for="provider in providerList" :key="provider.id">
            <div class="settings-panel__meta">
              <h4 class="settings-panel__command">{{ provider.label }}</h4>
              <p class="settings-panel__details">Default model: {{ ai.providers[provider.id].model }}</p>
            </div>
          </article>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useAiStore } from "@/stores/ai";

const ai = useAiStore();

const providerList = [
  { id: "openai" as const, label: "OpenAI" },
  { id: "deepseek" as const, label: "DeepSeek" },
];
</script>
