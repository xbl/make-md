import { findMatches, type FindOptions } from "@/editor/find-replace";

type TextSelectionResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function selectedLineBounds(value: string, selectionStart: number, selectionEnd: number) {
  const start = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const endLineAnchor = selectionEnd > 0 && value[selectionEnd - 1] === "\n" ? selectionEnd - 1 : selectionEnd;
  const newline = value.indexOf("\n", endLineAnchor);
  const end = newline === -1 ? value.length : newline;
  return { start, end };
}

export function indentSelectedLines(value: string, selectionStart: number, selectionEnd: number): TextSelectionResult {
  const { start, end } = selectedLineBounds(value, selectionStart, selectionEnd);
  const lines = value.slice(start, end).split("\n");
  const indented = lines.map((line) => `  ${line}`).join("\n");
  return {
    value: `${value.slice(0, start)}${indented}${value.slice(end)}`,
    selectionStart: selectionStart + 2,
    selectionEnd: selectionEnd + 2 * lines.length,
  };
}

export function outdentSelectedLines(value: string, selectionStart: number, selectionEnd: number): TextSelectionResult {
  const { start, end } = selectedLineBounds(value, selectionStart, selectionEnd);
  const lines = value.slice(start, end).split("\n");
  let removedBeforeStart = 0;
  let removedTotal = 0;
  const outdented = lines.map((line, index) => {
    if (line.startsWith("  ")) {
      removedTotal += 2;
      if (index === 0) {
        removedBeforeStart = 2;
      }
      return line.slice(2);
    }
    return line;
  }).join("\n");

  return {
    value: `${value.slice(0, start)}${outdented}${value.slice(end)}`,
    selectionStart: Math.max(start, selectionStart - removedBeforeStart),
    selectionEnd: Math.max(start, selectionEnd - removedTotal),
  };
}

export function findNextTextMatch(text: string, query: string, options: FindOptions, from: number) {
  const matches = findMatches(text, query, options);
  if (matches.length === 0) {
    return null;
  }
  const start = matches.find((index) => index >= from) ?? matches[0];
  return { from: start, to: start + query.length };
}

export function findPreviousTextMatch(text: string, query: string, options: FindOptions, from: number) {
  const matches = findMatches(text, query, options);
  if (matches.length === 0) {
    return null;
  }
  const previous = [...matches].reverse().find((index) => index < from) ?? matches[matches.length - 1];
  return { from: previous, to: previous + query.length };
}
