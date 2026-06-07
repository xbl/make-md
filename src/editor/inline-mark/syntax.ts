export type InlineToken =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "code"; value: string }
  | { type: "strike"; value: string }
  | { type: "link"; text: string; href: string }
  | { type: "image"; alt: string; src: string };

/** Single source of truth for inline Markdown delimiters (parser, input rules, paste). */
export const INLINE_MARKDOWN_PATTERN =
  /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]*)\]\(([^)]+)\)|\*\*([^*]+)\*\*|~~([^~]+)~~|(?<!\*)\*([^*]+)\*(?!\*)|_([^_]+)_|`([^`]+)`/g;

export const INPUT_RULE_PATTERNS = {
  strong: /\*\*([^*\n]+)\*\*$/,
  em: /(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*)$/,
  strike: /~~([^~\n]+)~~$/,
  code: /`([^`\n]+)`$/,
  link: /\[([^\]\n]+)\]\(([^)\n]+)\)$/,
} as const;

export function tokenizeInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_MARKDOWN_PATTERN.lastIndex = 0;
  while ((match = INLINE_MARKDOWN_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      tokens.push({ type: "image", alt: match[1], src: match[2] });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      tokens.push({ type: "link", text: match[3], href: match[4] });
    } else if (match[5] !== undefined) {
      tokens.push({ type: "strong", value: match[5] });
    } else if (match[6] !== undefined) {
      tokens.push({ type: "strike", value: match[6] });
    } else if (match[7] !== undefined || match[8] !== undefined) {
      tokens.push({ type: "em", value: match[7] ?? match[8]! });
    } else if (match[9] !== undefined) {
      tokens.push({ type: "code", value: match[9] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (tokens.length === 0 && text) {
    tokens.push({ type: "text", value: text });
  }

  return tokens;
}

export function containsInlineMarkdown(text: string): boolean {
  INLINE_MARKDOWN_PATTERN.lastIndex = 0;
  return INLINE_MARKDOWN_PATTERN.test(text);
}
