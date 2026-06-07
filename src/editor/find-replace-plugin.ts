import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { findMatches, type FindOptions } from "@/editor/find-replace";

export type FindReplaceState = {
  query: string;
  replaceWith: string;
  activeIndex: number;
  caseSensitive: boolean;
  wholeWord: boolean;
};

export const findReplaceKey = new PluginKey<FindReplaceState>("find-replace");

export function createFindReplacePlugin() {
  return new Plugin<FindReplaceState>({
    key: findReplaceKey,
    state: {
      init: () => ({
        query: "",
        replaceWith: "",
        activeIndex: 0,
        caseSensitive: false,
        wholeWord: false,
      }),
      apply(tr, value) {
        const meta = tr.getMeta(findReplaceKey);
        return meta ? { ...value, ...meta } : value;
      },
    },
    props: {
      decorations(state) {
        const pluginState = findReplaceKey.getState(state);
        if (!pluginState?.query) {
          return DecorationSet.empty;
        }

        const options: FindOptions = {
          caseSensitive: pluginState.caseSensitive,
          wholeWord: pluginState.wholeWord,
        };
        const decorations: Decoration[] = [];

        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) {
            return;
          }
          node.forEach((child, offset) => {
            if (!child.isText || !child.text) {
              return;
            }
            const matches = findMatches(child.text, pluginState.query, options);
            for (const match of matches) {
              decorations.push(
                Decoration.inline(pos + offset + 1 + match, pos + offset + 1 + match + pluginState.query.length, {
                  class: "find-match",
                }),
              );
            }
          });
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

export function setFindReplaceState(
  state: import("prosemirror-state").EditorState,
  patch: Partial<FindReplaceState>,
) {
  return state.tr.setMeta(findReplaceKey, patch);
}

export function replaceOneInDocument(
  state: import("prosemirror-state").EditorState,
  query: string,
  replacement: string,
  options: FindOptions,
) {
  let next = findNextMatch(state, query, options, state.selection.from);
  if (!next) {
    next = findNextMatch(state, query, options, 0);
  }
  if (!next) {
    return null;
  }
  return state.tr.insertText(replacement, next.from, next.to);
}

export function replaceAllInDocument(
  state: import("prosemirror-state").EditorState,
  query: string,
  replacement: string,
  options: FindOptions,
) {
  if (!query) {
    return null;
  }

  let tr = state.tr;
  let replaced = false;
  const ranges: Array<{ from: number; to: number; text: string }> = [];

  state.doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return;
    }
    node.forEach((child, offset) => {
      if (!child.isText || !child.text) {
        return;
      }
      const nextText = child.text;
      const matches = findMatches(nextText, query, options);
      for (let i = matches.length - 1; i >= 0; i -= 1) {
        const match = matches[i]!;
        const from = pos + offset + 1 + match;
        const to = from + query.length;
        ranges.push({
          from,
          to,
          text: replacement,
        });
      }
    });
  });

  ranges.sort((a, b) => b.from - a.from);
  for (const range of ranges) {
    tr = tr.insertText(range.text, range.from, range.to);
    replaced = true;
  }

  return replaced ? tr : null;
}

export function findNextMatch(
  state: import("prosemirror-state").EditorState,
  query: string,
  options: FindOptions,
  from: number,
) {
  let result: { from: number; to: number } | null = null;

  state.doc.descendants((node, pos) => {
    if (result || !node.isTextblock) {
      return;
    }
    node.forEach((child, offset) => {
      if (result || !child.isText || !child.text) {
        return;
      }
      const matches = findMatches(child.text, query, options);
      for (const match of matches) {
        const start = pos + offset + 1 + match;
        const end = start + query.length;
        if (start >= from) {
          result = { from: start, to: end };
          return;
        }
      }
    });
  });

  return result;
}
