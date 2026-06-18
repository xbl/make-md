const CJK_RE = /[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/gu;
const WORD_RE = /[a-zA-ZÀ-ɏ]+/g;

export function countWords(text: string): number {
  let count = 0;
  const cjk = text.match(CJK_RE);
  if (cjk) {
    count += cjk.length;
  }

  const nonCjk = text.replace(CJK_RE, " ");
  const words = nonCjk.match(WORD_RE);
  if (words) {
    count += words.length;
  }

  return count;
}

export function countChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function readingTimeMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200));
}
