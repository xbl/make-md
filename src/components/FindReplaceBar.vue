<template>
  <div v-if="ui.findReplaceOpen" class="find-bar">
    <input
      ref="queryInput"
      v-model="query"
      type="text"
      class="find-bar__input"
      placeholder="Find"
      @keydown.enter.exact.prevent="findNext"
      @keydown.enter.shift.prevent="findPrevious"
    />
    <input
      v-if="ui.findReplaceMode === 'replace'"
      v-model="replaceWith"
      type="text"
      class="find-bar__input"
      placeholder="Replace"
    />
    <label class="find-bar__toggle">
      <input v-model="caseSensitive" type="checkbox" />
      Case
    </label>
    <label class="find-bar__toggle">
      <input v-model="wholeWord" type="checkbox" />
      Word
    </label>
    <button type="button" class="find-bar__button" @click="findPrevious">Prev</button>
    <button type="button" class="find-bar__button" @click="findNext">Next</button>
    <button
      v-if="ui.findReplaceMode === 'replace'"
      type="button"
      class="find-bar__button"
      @click="replaceOne"
    >
      Replace
    </button>
    <button
      v-if="ui.findReplaceMode === 'replace'"
      type="button"
      class="find-bar__button"
      @click="replaceAll"
    >
      All
    </button>
    <button type="button" class="find-bar__button" @click="ui.closeFindReplace()">Close</button>
  </div>
</template>

<script setup lang="ts">
import { inject, nextTick, ref, watch } from "vue";
import { TextSelection } from "prosemirror-state";
import { EditorViewKey } from "@/editor/editor-context";
import { findMatches } from "@/editor/find-replace";
import {
  findNextMatch,
  replaceAllInDocument,
  replaceOneInDocument,
  setFindReplaceState,
} from "@/editor/find-replace-plugin";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const editorContext = inject(EditorViewKey);
const query = ref("");
const replaceWith = ref("");
const caseSensitive = ref(false);
const wholeWord = ref(false);
const queryInput = ref<HTMLInputElement | null>(null);

const options = () => ({
  caseSensitive: caseSensitive.value,
  wholeWord: wholeWord.value,
});

function syncPluginState() {
  const view = editorContext?.view.value;
  if (!view) {
    return;
  }
  view.dispatch(
    setFindReplaceState(view.state, {
      query: query.value,
      replaceWith: replaceWith.value,
      caseSensitive: caseSensitive.value,
      wholeWord: wholeWord.value,
    }),
  );
}

function selectMatch(from: number, to: number) {
  const view = editorContext?.view.value;
  if (!view) {
    return;
  }
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)).scrollIntoView());
  view.focus();
}

function findNext() {
  syncPluginState();
  const view = editorContext?.view.value;
  if (!view || !query.value) {
    return;
  }
  const next = findNextMatch(view.state, query.value, options(), view.state.selection.to + 1)
    ?? findNextMatch(view.state, query.value, options(), 0);
  if (next) {
    selectMatch(next.from, next.to);
  }
}

function findPrevious() {
  syncPluginState();
  const view = editorContext?.view.value;
  if (!view || !query.value) {
    return;
  }
  const matches: Array<{ from: number; to: number }> = [];
  view.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return;
    }
    node.forEach((child, offset) => {
      if (!child.isText || !child.text) {
        return;
      }
      for (const match of findMatches(child.text, query.value, options())) {
        matches.push({
          from: pos + offset + 1 + match,
          to: pos + offset + 1 + match + query.value.length,
        });
      }
    });
  });
  const current = view.state.selection.from;
  const previous = [...matches].reverse().find((match) => match.from < current) ?? matches[matches.length - 1];
  if (previous) {
    selectMatch(previous.from, previous.to);
  }
}

function replaceOne() {
  syncPluginState();
  const view = editorContext?.view.value;
  if (!view) {
    return;
  }
  const tr = replaceOneInDocument(view.state, query.value, replaceWith.value, options());
  if (tr) {
    view.dispatch(tr);
    findNext();
  }
}

function replaceAll() {
  syncPluginState();
  const view = editorContext?.view.value;
  if (!view) {
    return;
  }
  const tr = replaceAllInDocument(view.state, query.value, replaceWith.value, options());
  if (tr) {
    view.dispatch(tr);
  }
}

watch([query, replaceWith, caseSensitive, wholeWord], syncPluginState);

watch(
  () => ui.findReplaceOpen,
  async (open) => {
    if (open) {
      await nextTick();
      queryInput.value?.focus();
      syncPluginState();
    } else {
      const view = editorContext?.view.value;
      if (view) {
        view.dispatch(setFindReplaceState(view.state, { query: "" }));
      }
    }
  },
);
</script>
