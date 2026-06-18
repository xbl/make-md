<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast--${toast.type}`"
        >
          <span class="toast__icon">
            <svg v-if="toast.type === 'success'" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else-if="toast.type === 'error'" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="1.2" fill="currentColor"/>
            </svg>
          </span>
          <span class="toast__message">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from "@/composables/useToast";

const { toasts } = useToast();
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
  max-width: 320px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 7px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  box-shadow: 0 2px 12px rgba(28, 28, 26, 0.08);
  font-family: var(--font-ui);
  font-size: 12.5px;
  color: var(--text-primary);
  line-height: 1.4;
  pointer-events: auto;
  letter-spacing: 0.01em;
}

.toast--success {
  background: #f6f8f3;
  border-color: #c8d6c0;
  color: #3d5430;
}

:root[data-theme="dark"] .toast--success {
  background: #1e241a;
  border-color: #3d5430;
  color: #b8ccaa;
}

.toast--error {
  background: #faf5f5;
  border-color: #dcc8c8;
  color: #6b3535;
}

:root[data-theme="dark"] .toast--error {
  background: #241a1a;
  border-color: #543030;
  color: #ccaaaa;
}

.toast--info {
  background: #f4f6f9;
  border-color: #c4cddb;
  color: #3a4d68;
}

:root[data-theme="dark"] .toast--info {
  background: #1a1e24;
  border-color: #304054;
  color: #aab8cc;
}

.toast__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.7;
}

.toast__message {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Slide-in from right */
.toast-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-leave-active {
  transition: all 0.18s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(32px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
