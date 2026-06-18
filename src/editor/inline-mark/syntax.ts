export type InlineToken =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "em"; value: string }
  | { type: "code"; value: string }
  | { type: "strike"; value: string }
  | { type: "link"; text: string; href: string }
  | { type: "image"; alt: string; src: string; title?: string };

/** Single source of truth for inline Markdown delimiters (parser, input rules, paste). */
export const INLINE_MARKDOWN_PATTERN =
  /!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]*)")?\)|\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|(?<!\*)\*([^*]+)\*(?!\*)|(?<!\w)_([^_]+)_(?!\w)/g;

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
      tokens.push({ type: "image", alt: match[1], src: match[2], title: match[3] || undefined });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      tokens.push({ type: "link", text: match[4], href: match[5] });
    } else if (match[6] !== undefined) {
      tokens.push({ type: "code", value: match[6] });
    } else if (match[7] !== undefined) {
      tokens.push({ type: "strong", value: match[7] });
    } else if (match[8] !== undefined) {
      tokens.push({ type: "strike", value: match[8] });
    } else if (match[9] !== undefined || match[10] !== undefined) {
      tokens.push({ type: "em", value: match[9] ?? match[10]! });
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
