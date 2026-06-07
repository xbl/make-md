export type FindOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
};

export function findMatches(text: string, query: string, options: FindOptions): number[] {
  if (!query) {
    return [];
  }

  const matches: number[] = [];
  const source = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  let index = source.indexOf(needle);

  while (index !== -1) {
    if (!options.wholeWord || isWholeWord(text, index, query.length)) {
      matches.push(index);
    }
    index = source.indexOf(needle, index + Math.max(needle.length, 1));
  }

  return matches;
}

function isWholeWord(text: string, index: number, length: number) {
  const before = index > 0 ? text[index - 1] : " ";
  const after = index + length < text.length ? text[index + length] : " ";
  return !/\w/.test(before) && !/\w/.test(after);
}

export function replaceAt(text: string, index: number, query: string, replacement: string) {
  return `${text.slice(0, index)}${replacement}${text.slice(index + query.length)}`;
}
