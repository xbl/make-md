import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";

const KEYWORDS = new Set([
  "if",
  "else",
  "return",
  "const",
  "let",
  "var",
  "function",
  "class",
  "import",
  "export",
  "from",
  "true",
  "false",
  "null",
  "undefined",
  "new",
  "this",
  "async",
  "await",
  "for",
  "while",
  "switch",
  "case",
  "break",
  "continue",
  "try",
  "catch",
  "throw",
  "typeof",
  "instanceof",
  "in",
  "of",
  "void",
  "delete",
]);

export type InlineCodeTokenKind = "string" | "number" | "keyword" | "operator";

export type InlineCodeToken = {
  from: number;
  to: number;
  kind: InlineCodeTokenKind;
  text: string;
};

const STRING_RE = /(['"])(?:\\.|(?!\1)[^\\])*\1/g;
const NUMBER_RE = /\b\d+(?:\.\d+)?\b/g;
const OPERATOR_RE = /[=<>!+\-*\/&|?:]+/g;

function overlaps(tokens: InlineCodeToken[], from: number, to: number): boolean {
  return tokens.some((token) => from < token.to && to > token.from);
}

function collectRegexTokens(
  text: string,
  regex: RegExp,
  kind: InlineCodeTokenKind,
  tokens: InlineCodeToken[],
) {
  regex.lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    const from = match.index;
    const to = from + match[0].length;
    if (!overlaps(tokens, from, to)) {
      tokens.push({ from, to, kind, text: match[0] });
    }
    match = regex.exec(text);
  }
}

function collectKeywordTokens(text: string, tokens: InlineCodeToken[]) {
  const wordRe = /\b[A-Za-z_]+\b/g;
  let match = wordRe.exec(text);
  while (match) {
    const word = match[0];
    const from = match.index;
    const to = from + word.length;
    if (KEYWORDS.has(word) && !overlaps(tokens, from, to)) {
      tokens.push({ from, to, kind: "keyword", text: word });
    }
    match = wordRe.exec(text);
  }
}

export function tokenizeInlineCodeHeuristic(text: string): InlineCodeToken[] {
  const tokens: InlineCodeToken[] = [];
  collectRegexTokens(text, STRING_RE, "string", tokens);
  collectRegexTokens(text, NUMBER_RE, "number", tokens);
  collectKeywordTokens(text, tokens);
  collectRegexTokens(text, OPERATOR_RE, "operator", tokens);
  return tokens.sort((a, b) => a.from - b.from);
}

function classForKind(kind: InlineCodeTokenKind): string {
  switch (kind) {
    case "string":
      return "ic-str";
    case "number":
      return "ic-num";
    case "keyword":
      return "ic-kw";
    case "operator":
      return "ic-op";
  }
}

function buildInlineCodeDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText) {
      return;
    }

    for (const mark of node.marks) {
      if (mark.type.name !== "code") {
        continue;
      }

      const tokens = tokenizeInlineCodeHeuristic(node.text ?? "");
      for (const token of tokens) {
        decorations.push(
          Decoration.inline(pos + token.from, pos + token.to, {
            class: classForKind(token.kind),
          }),
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export function createInlineCodeDecorationsPlugin() {
  return new Plugin({
    props: {
      decorations(state) {
        return buildInlineCodeDecorations(state.doc);
      },
    },
  });
}
