import type { PDFDocument, PDFFont } from "pdf-lib";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface PageConfig {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  contentWidth: number;
  contentHeight: number;
  contentLeft: number;
  contentRight: number;
  contentTop: number;
  contentBottom: number;
  bodyFontSize: number;
  bodyLineHeight: number;
  codeFontSize: number;
  codeLineHeight: number;
}

export interface PdfFonts {
  body: PDFFont;
  bodyBold: PDFFont;
  mono: PDFFont;
}

export interface FormattedRun {
  text: string;
  font: PDFFont;
  fontSize: number;
  strikethrough: boolean;
  color?: RgbColor;
}

export interface LayoutLine {
  runs: FormattedRun[];
  width: number;
  height: number;
}

export const PAGE_CONFIG: PageConfig = {
  pageWidth: 612, // 8.5in
  pageHeight: 792, // 11in
  marginTop: 72, // 1in
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
  contentWidth: 468,
  contentHeight: 648,
  contentLeft: 72,
  contentRight: 540,
  contentTop: 720,   // pageHeight - marginTop
  contentBottom: 72, // marginBottom
  bodyFontSize: 11,
  bodyLineHeight: 19.58, // 11 * 1.78
  codeFontSize: 9,
  codeLineHeight: 13.95, // 9 * 1.55
};

export const COLORS: Record<string, RgbColor> = {
  text: { r: 0.11, g: 0.11, b: 0.10 },
  textSecondary: { r: 0.36, g: 0.36, b: 0.34 },
  textMuted: { r: 0.35, g: 0.35, b: 0.33 },
  border: { r: 0.89, g: 0.89, b: 0.86 },
  codeBg: { r: 0.94, g: 0.94, b: 0.92 },
  codeText: { r: 0.24, g: 0.24, b: 0.22 },
  quoteBorder: { r: 0.77, g: 0.74, b: 0.69 },
  quoteText: { r: 0.35, g: 0.35, b: 0.33 },
  tableHeaderBg: { r: 0.94, g: 0.94, b: 0.92 },
};
