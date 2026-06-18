<template>
  <div class="source-editor" data-testid="source-editor">
    <div ref="gutterRef" class="source-editor__gutter" data-testid="source-gutter" aria-hidden="true">
      <span
        v-for="line in lineNumbers"
        :key="line"
        class="source-editor__line-number"
        :class="{ 'source-editor__line-number--active': line === activeLine }"
      >{{ line }}</span>
    </div>
    <div class="source-editor__surface">
      <div class="source-editor__active-line" :style="activeLineStyle" aria-hidden="true"></div>
      <pre
        ref="highlightRef"
        class="source-editor__highlight hljs language-markdown"
        data-testid="source-highlight"
        aria-hidden="true"
        v-html="highlightedHtml"
      ></pre>
      <textarea
        ref="inputRef"
        :value="modelValue"
        class="source-editor__input"
        data-testid="source-input"
        spellcheck="false"
        @input="onInput"
        @click="syncSelection"
        @keyup="syncSelection"
        @keydown="onKeydown"
        @scroll="syncScroll"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { highlightCode, resolveHighlightLanguage } from "@/editor/syntax-highlight/languages";
import { indentSelectedLines, outdentSelectedLines } from "@/lib/source-editor-text";
import { useEditorStore } from "@/stores/editor";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const editorStore = useEditorStore();
const inputRef = ref<HTMLTextAreaElement | null>(null);
const highlightRef = ref<HTMLElement | null>(null);
const gutterRef = ref<HTMLElement | null>(null);
const activeLine = ref(1);
const scrollTop = ref(0);

const highlightedHtml = computed(() => highlightCode(props.modelValue, resolveHighlightLanguage("markdown")));
const lineNumbers = computed(() => {
  const lineCount = props.modelValue.split("\n").length;
  return Array.from({ length: Math.max(1, lineCount) }, (_, index) => index + 1);
});
const activeLineStyle = computed(() => ({
  transform: `translateY(${24 + (activeLine.value - 1) * (14 * 1.7) - scrollTop.value}px)`,
}));

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement | null;
  if (!target) {
    return;
  }
  emit("update:modelValue", target.value);
  editorStore.setSourceContent(target.value);
  syncSelection();
}

function syncScroll() {
  if (!inputRef.value || !highlightRef.value || !gutterRef.value) {
    return;
  }
  scrollTop.value = inputRef.value.scrollTop;
  highlightRef.value.scrollTop = inputRef.value.scrollTop;
  highlightRef.value.scrollLeft = inputRef.value.scrollLeft;
  gutterRef.value.scrollTop = inputRef.value.scrollTop;
}

function syncSelection() {
  if (!inputRef.value) {
    return;
  }
  const caret = inputRef.value.selectionStart ?? 0;
  activeLine.value = inputRef.value.value.slice(0, caret).split("\n").length;
}

async function applyValue(nextValue: string, selectionStart: number, selectionEnd = selectionStart) {
  emit("update:modelValue", nextValue);
  await nextTick();
  if (!inputRef.value) {
    return;
  }
  inputRef.value.selectionStart = selectionStart;
  inputRef.value.selectionEnd = selectionEnd;
  syncSelection();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Tab" || !inputRef.value) {
    return;
  }

  event.preventDefault();
  const input = inputRef.value;
  const result = event.shiftKey
    ? outdentSelectedLines(input.value, input.selectionStart, input.selectionEnd)
    : indentSelectedLines(input.value, input.selectionStart, input.selectionEnd);
  void applyValue(result.value, result.selectionStart, result.selectionEnd);
}

onMounted(() => {
  editorStore.setSourceContent(props.modelValue);
  editorStore.setSourceEditor({
    getValue: () => inputRef.value?.value ?? props.modelValue,
    getSelection: () => ({
      start: inputRef.value?.selectionStart ?? 0,
      end: inputRef.value?.selectionEnd ?? 0,
    }),
    setSelection: (start, end) => {
      if (!inputRef.value) {
        return;
      }
      inputRef.value.selectionStart = start;
      inputRef.value.selectionEnd = end;
      syncSelection();
    },
    replaceSelection: (nextValue, selectionStart, selectionEnd) => {
      void applyValue(nextValue, selectionStart, selectionEnd);
    },
    focus: () => inputRef.value?.focus(),
  });
});

onBeforeUnmount(() => {
  editorStore.setSourceEditor(null);
});
</script>
