import { marked } from "marked";
import type { PdfFonts, FormattedRun, LayoutLine, RgbColor } from "./types";
import { COLORS } from "./types";

// ── CJK detection ──

function isCJK(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x3000 && cp <= 0x303f) || // CJK Symbols & Punctuation
    (cp >= 0xff00 && cp <= 0xffef) || // Halfwidth/Fullwidth Forms
    (cp >= 0xfe30 && cp <= 0xfe4f) // CJK Compatibility Forms
  );
}

function isCJKString(text: string): boolean {
  return [...text].some((ch) => isCJK(ch.codePointAt(0)!));
}

// ── Measurement ──

function measureText(font: FormattedRun["font"], text: string, size: number): number {
  return font.widthOfTextAtSize(text, size);
}

function lineHeightAtSize(font: FormattedRun["font"], size: number): number {
  return font.heightAtSize(size);
}

// ── Inline token flattening ──

type MToken = {
  type: string;
  text?: string;
  raw?: string;
  tokens?: MToken[];
};

function stripHtmlTags(value: string): string {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
}

export function flattenInlineTokens(
  text: string,
  fonts: PdfFonts,
  baseSize: number,
  baseFont: "body" | "bodyBold" | "mono" = "body",
  baseColor?: RgbColor,
  strikethrough = false,
): FormattedRun[] {
  const tokens = marked.Lexer.lexInline(text) as MToken[];
  return flattenTokens(tokens, fonts, baseSize, baseFont, baseColor, strikethrough);
}

function flattenTokens(
  tokens: MToken[],
  fonts: PdfFonts,
  size: number,
  currentFont: "body" | "bodyBold" | "mono",
  color: RgbColor | undefined,
  strikethrough: boolean,
): FormattedRun[] {
  const runs: FormattedRun[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "strong":
        runs.push(
          ...flattenTokens(token.tokens ?? [], fonts, size, "bodyBold", color, strikethrough),
        );
        break;
      case "em":
        // No italic face available; render as regular with same weight
        runs.push(
          ...flattenTokens(token.tokens ?? [], fonts, size, currentFont, color, strikethrough),
        );
        break;
      case "del":
        runs.push(
          ...flattenTokens(token.tokens ?? [], fonts, size, currentFont, color, true),
        );
        break;
      case "codespan":
        runs.push({
          text: token.text ?? "",
          font: fonts.mono,
          fontSize: size * 0.85,
          strikethrough: false,
          color: COLORS.codeText,
        });
        break;
      case "link":
        // Render link text (no clickable annotation in v1)
        runs.push(
          ...flattenTokens(token.tokens ?? [], fonts, size, currentFont, color, strikethrough),
        );
        break;
      case "br":
        runs.push({
          text: "\n",
          font: resolveFont(fonts, currentFont),
          fontSize: size,
          strikethrough: false,
          color,
        });
        break;
      case "html":
        runs.push({
          text: stripHtmlTags(token.raw ?? token.text ?? ""),
          font: resolveFont(fonts, currentFont),
          fontSize: size,
          strikethrough: false,
          color,
        });
        break;
      case "text":
      case "escape":
        runs.push({
          text: token.text ?? "",
          font: resolveFont(fonts, currentFont),
          fontSize: size,
          strikethrough,
          color,
        });
        break;
      default:
        if (Array.isArray(token.tokens) && token.tokens.length > 0) {
          runs.push(
            ...flattenTokens(token.tokens, fonts, size, currentFont, color, strikethrough),
          );
        } else if (token.text) {
          runs.push({
            text: token.text,
            font: resolveFont(fonts, currentFont),
            fontSize: size,
            strikethrough,
            color,
          });
        }
    }
  }

  return mergeAdjacentRuns(runs);
}

function resolveFont(fonts: PdfFonts, name: "body" | "bodyBold" | "mono") {
  if (name === "bodyBold") return fonts.bodyBold;
  if (name === "mono") return fonts.mono;
  return fonts.body;
}

// Merge adjacent runs with identical style to reduce draw calls
function mergeAdjacentRuns(runs: FormattedRun[]): FormattedRun[] {
  const merged: FormattedRun[] = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.font === run.font &&
      prev.fontSize === run.fontSize &&
      prev.strikethrough === run.strikethrough &&
      colorEq(prev.color, run.color)
    ) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function colorEq(a?: RgbColor, b?: RgbColor): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

// ── Line wrapping ──

export function wrapLines(runs: FormattedRun[], maxWidth: number): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let currentLine: FormattedRun[] = [];
  let currentWidth = 0;
  let currentHeight = 0;

  function commitLine() {
    if (currentLine.length > 0) {
      lines.push({
        runs: currentLine,
        width: currentWidth,
        height: currentHeight || 12,
      });
    }
    currentLine = [];
    currentWidth = 0;
    currentHeight = 0;
  }

  function placeRunOrBreak(run: FormattedRun): void {
    const runWidth = measureText(run.font, run.text, run.fontSize);
    const runHeight = lineHeightAtSize(run.font, run.fontSize);

    if (currentWidth + runWidth <= maxWidth) {
      // Fits on current line
      currentLine.push(run);
      currentWidth += runWidth;
      currentHeight = Math.max(currentHeight, runHeight);
      return;
    }

    if (currentLine.length > 0) {
      // Line has room — try to split the run at the boundary
      const remaining = maxWidth - currentWidth;
      const breakIdx = findBreakIndex(run.text, run.font, run.fontSize, remaining);
      if (breakIdx > 0) {
        const firstPart = run.text.slice(0, breakIdx);
        currentLine.push({ ...run, text: firstPart });
        currentWidth += measureText(run.font, firstPart, run.fontSize);
        currentHeight = Math.max(currentHeight, runHeight);
        commitLine();
        const remainder = run.text.slice(breakIdx);
        if (remainder.length > 0) {
          placeRunOrBreak({ ...run, text: remainder });
        }
        return;
      }
      // Can't split — move entire run to next line
      commitLine();
    }

    // Empty line: break run across potentially many lines
    let remainingText = run.text;
    while (remainingText.length > 0) {
      const breakIdx = findBreakIndex(remainingText, run.font, run.fontSize, maxWidth);
      if (breakIdx > 0) {
        const firstPart = remainingText.slice(0, breakIdx);
        currentLine.push({ ...run, text: firstPart });
        currentWidth += measureText(run.font, firstPart, run.fontSize);
        currentHeight = Math.max(currentHeight, runHeight);
        commitLine();
        remainingText = remainingText.slice(breakIdx);
      } else {
        // Can't break further — place what remains
        currentLine.push({ ...run, text: remainingText });
        currentWidth += measureText(run.font, remainingText, run.fontSize);
        currentHeight = Math.max(currentHeight, runHeight);
        break;
      }
    }
  }

  for (const run of runs) {
    if (run.text.includes("\n")) {
      const parts = run.text.split("\n");
      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi]!;
        if (part.length > 0) {
          placeRunOrBreak({ ...run, text: part });
        }
        if (pi < parts.length - 1) {
          commitLine();
        }
      }
      continue;
    }

    placeRunOrBreak(run);
  }

  commitLine();
  return lines;
}

function findBreakIndex(
  text: string,
  font: FormattedRun["font"],
  size: number,
  maxWidth: number,
): number {
  const chars = [...text];
  let width = 0;
  let lastSpace = -1;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const chCp = ch.codePointAt(0)!;
    const chWidth = measureText(font, ch, size);
    width += chWidth;

    if (width > maxWidth) {
      // If we found a space, break there. CJK text breaks at any character.
      if (lastSpace > 0) return lastSpace + 1;
      if (isCJK(chCp)) return i;
      // For Latin text, find last CJK boundary or just break
      for (let j = i; j > 0; j--) {
        if (isCJK(chars[j]!.codePointAt(0)!)) return j;
      }
      return Math.max(1, i);
    }

    if (ch === " " || ch === "\t") {
      lastSpace = i;
    }

    // CJK allows breaking after any CJK character
    if (isCJK(chCp) && i < chars.length - 1) {
      lastSpace = i;
    }
  }

  return chars.length;
}

// ── Rich text layout ──

export interface LayoutResult {
  lines: LayoutLine[];
  totalHeight: number;
}

export function layoutRichText(
  text: string,
  fonts: PdfFonts,
  fontSize: number,
  maxWidth: number,
  lineHeightFactor = 1.78,
  font: "body" | "bodyBold" | "mono" = "body",
  color?: RgbColor,
): LayoutResult {
  const runs = flattenInlineTokens(text, fonts, fontSize, font, color);
  const lines = wrapLines(runs, maxWidth);

  const lineAdvance = lineHeightAtSize(fonts.body, fontSize) * lineHeightFactor;
  const totalHeight = lines.length > 0 ? lines.length * lineAdvance : 0;

  return { lines, totalHeight };
}

export function measureLineHeight(fonts: PdfFonts, fontSize: number, lineHeightFactor = 1.78): number {
  const base = lineHeightAtSize(fonts.body, fontSize);
  return base * lineHeightFactor;
}
