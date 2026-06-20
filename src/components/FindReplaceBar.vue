<template>
  <div v-if="ui.findReplaceOpen" class="find-bar find-bar--floating">
    <div class="find-bar__query">
      <input
        ref="queryInput"
        v-model="query"
        type="text"
        class="find-bar__input"
        placeholder="Find"
        @keydown.enter.exact.prevent="findNext"
        @keydown.enter.shift.prevent="findPrevious"
      />
      <button
        type="button"
        class="find-bar__icon-button"
        title="Previous match"
        aria-label="Previous match"
        @mousedown.prevent
        @click="findPrevious"
      >
        ↑
      </button>
      <button
        type="button"
        class="find-bar__icon-button"
        title="Next match"
        aria-label="Next match"
        @mousedown.prevent
        @click="findNext"
      >
        ↓
      </button>
    </div>
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
    <span v-if="query" class="find-bar__count">{{ activeMatchLabel() }}</span>
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
import { nextTick, ref, watch } from "vue";
import { TextSelection } from "prosemirror-state";
import { findMatches } from "@/editor/find-replace";
import {
  findNextMatch,
  replaceAllInDocument,
  replaceOneInDocument,
  setFindReplaceState,
} from "@/editor/find-replace-plugin";
import { scrollEditorToPosition } from "@/lib/editor-scroll";
import { findNextTextMatch, findPreviousTextMatch } from "@/lib/source-editor-text";
import { useEditorStore } from "@/stores/editor";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const editorStore = useEditorStore();
const query = ref("");
const replaceWith = ref("");
const caseSensitive = ref(false);
const wholeWord = ref(false);
const queryInput = ref<HTMLInputElement | null>(null);
const totalMatches = ref(0);
const activeMatchNumber = ref(0);

const options = () => ({
  caseSensitive: caseSensitive.value,
  wholeWord: wholeWord.value,
});

function collectMatches() {
  if (ui.sourceMode) {
    const sourceEditor = editorStore.sourceEditor;
    const text = sourceEditor?.getValue() ?? "";
    return findMatches(text, query.value, options()).map((from) => ({
      from,
      to: from + query.value.length,
    }));
  }

  const view = editorStore.view;
  if (!view || !query.value) {
    return [] as Array<{ from: number; to: number }>;
  }

  const matches: Array<{ from: number; to: number }> = [];
  view.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return;
    }
    for (const match of findMatches(node.textContent, query.value, options())) {
      const range = resolveTextRange(node, pos, match, query.value.length);
      if (range) {
        matches.push(range);
      }
    }
  });

  return matches;
}

function refreshMatchStatus() {
  const matches = collectMatches();
  totalMatches.value = matches.length;

  if (ui.sourceMode) {
    const selection = editorStore.sourceEditor?.getSelection();
    if (!selection || matches.length === 0) {
      activeMatchNumber.value = 0;
      return;
    }
    const index = matches.findIndex(
      (match) => match.from === selection.start && match.to === selection.end,
    );
    activeMatchNumber.value = index >= 0 ? index + 1 : 0;
    return;
  }

  const view = editorStore.view;
  if (!view || matches.length === 0) {
    activeMatchNumber.value = 0;
    return;
  }

  const index = matches.findIndex(
    (match) =>
      match.from === view.state.selection.from
      && match.to === view.state.selection.to,
  );
  activeMatchNumber.value = index >= 0 ? index + 1 : 0;
}

function activeMatchLabel() {
  if (!query.value) {
    return "";
  }
  return `${activeMatchNumber.value}/${totalMatches.value}`;
}

function syncPluginState() {
  if (ui.sourceMode) {
    refreshMatchStatus();
    return;
  }

  const view = editorStore.view;
  if (!view || !view.dom.parentNode) {
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
  refreshMatchStatus();
}

function selectMatch(from: number, to: number) {
  if (ui.sourceMode) {
    editorStore.sourceEditor?.setSelection(from, to);
    refreshMatchStatus();
    void nextTick(() => queryInput.value?.focus());
    return;
  }

  const view = editorStore.view;
  if (!view || !view.dom.parentNode) {
    return;
  }
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)).scrollIntoView());
  scrollEditorToPosition(view, Math.max(0, from - 1));
  refreshMatchStatus();
  void nextTick(() => queryInput.value?.focus());
}

function selectedText() {
  if (ui.sourceMode) {
    const sourceEditor = editorStore.sourceEditor;
    const selection = sourceEditor?.getSelection();
    const text = sourceEditor?.getValue() ?? "";
    if (!selection || selection.start === selection.end) {
      return "";
    }
    return text.slice(selection.start, selection.end);
  }

  const view = editorStore.view;
  if (!view || view.state.selection.empty) {
    return "";
  }
  return view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, "\n");
}

function findNext() {
  if (!query.value) {
    return;
  }

  if (ui.sourceMode) {
    const sourceEditor = editorStore.sourceEditor;
    const selection = sourceEditor?.getSelection();
    const text = sourceEditor?.getValue() ?? "";
    if (!sourceEditor || !selection) {
      return;
    }
    const next = findNextTextMatch(text, query.value, options(), selection.end);
    if (next) {
      selectMatch(next.from, next.to);
    }
    return;
  }

  const view = editorStore.view;
  if (!view || !view.dom.parentNode) {
    return;
  }
  const next = findNextMatch(view.state, query.value, options(), view.state.selection.to + 1)
    ?? findNextMatch(view.state, query.value, options(), 0);
  if (next) {
    selectMatch(next.from, next.to);
  }
}

function findPrevious() {
  if (!query.value) {
    return;
  }

  if (ui.sourceMode) {
    const sourceEditor = editorStore.sourceEditor;
    const selection = sourceEditor?.getSelection();
    const text = sourceEditor?.getValue() ?? "";
    if (!sourceEditor || !selection) {
      return;
    }
    const previous = findPreviousTextMatch(text, query.value, options(), selection.start);
    if (previous) {
      selectMatch(previous.from, previous.to);
    }
    return;
  }

  const view = editorStore.view;
  if (!view || !view.dom.parentNode) {
    return;
  }
  const matches = collectMatches();
  if (matches.length === 0) return;
  const current = view.state.selection.from;
  const previous = [...matches].reverse().find((match) => match.from < current) ?? matches[matches.length - 1];
  if (previous) {
    selectMatch(previous.from, previous.to);
  }
}

function replaceOne() {
  if (ui.sourceMode) {
    const sourceEditor = editorStore.sourceEditor;
    const selection = sourceEditor?.getSelection();
    const text = sourceEditor?.getValue() ?? "";
    if (!sourceEditor || !selection || !query.value) {
      return;
    }
    const next = findNextTextMatch(text, query.value, options(), selection.start);
    if (!next) {
      return;
    }
    const value = `${text.slice(0, next.from)}${replaceWith.value}${text.slice(next.to)}`;
    const caret = next.from + replaceWith.value.length;
    sourceEditor.replaceSelection(value, caret, caret);
    findNext();
    return;
  }

  const view = editorStore.view;
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
  if (ui.sourceMode) {
    const sourceEditor = editorStore.sourceEditor;
    const text = sourceEditor?.getValue() ?? "";
    if (!sourceEditor || !query.value) {
      return;
    }
    const matches = [...findMatches(text, query.value, options())].reverse();
    let nextValue = text;
    for (const index of matches) {
      nextValue = `${nextValue.slice(0, index)}${replaceWith.value}${nextValue.slice(index + query.value.length)}`;
    }
    sourceEditor.replaceSelection(nextValue, 0, 0);
    refreshMatchStatus();
    return;
  }

  const view = editorStore.view;
  if (!view) {
    return;
  }
  const tr = replaceAllInDocument(view.state, query.value, replaceWith.value, options());
  if (tr) {
    view.dispatch(tr);
    refreshMatchStatus();
  }
}

watch([query, replaceWith, caseSensitive, wholeWord], syncPluginState);

watch(
  () => ui.findReplaceOpen,
  async (open) => {
    if (open) {
      if (!query.value) {
        query.value = selectedText();
      }
      await nextTick();
      queryInput.value?.focus();
      queryInput.value?.select();
      syncPluginState();
    } else {
      const view = editorStore.view;
      if (view && !ui.sourceMode) {
        view.dispatch(setFindReplaceState(view.state, { query: "" }));
      }
      totalMatches.value = 0;
      activeMatchNumber.value = 0;
    }
  },
);

function resolveTextRange(
  node: import("prosemirror-model").Node,
  pos: number,
  matchIndex: number,
  matchLength: number,
): { from: number; to: number } | null {
  let startOffset: number | null = null;
  let endOffset: number | null = null;
  let cursor = 0;

  node.forEach((child, offset) => {
    if (!child.isText || !child.text) {
      return;
    }
    const nextCursor = cursor + child.text.length;
    if (startOffset === null && matchIndex >= cursor && matchIndex < nextCursor) {
      startOffset = offset + 1 + (matchIndex - cursor);
    }
    if (endOffset === null && matchIndex + matchLength > cursor && matchIndex + matchLength <= nextCursor) {
      endOffset = offset + 1 + (matchIndex + matchLength - cursor);
    }
    cursor = nextCursor;
  });

  if (startOffset === null) {
    return null;
  }
  if (endOffset === null) {
    endOffset = startOffset + matchLength;
  }

  return {
    from: pos + startOffset,
    to: pos + endOffset,
  };
}
</script>
