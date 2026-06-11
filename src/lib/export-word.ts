import mermaid from "mermaid";
import { marked } from "marked";
import { resolveImageSource } from "@/lib/image-source";
import { pickSaveWordFile, writeBinaryFile } from "@/lib/file-service";

export type WordBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "listItem"; text: string; ordered: boolean; level: number; number?: number }
  | { type: "blockquote"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "mermaid"; code: string; png: Uint8Array }
  | { type: "image"; alt: string; png: Uint8Array }
  | { type: "table"; rows: string[][]; headerRowCount: number };

export type WordExportPayload = {
  title: string;
  blocks: WordBlock[];
};

let mermaidReady = false;
const MARKDOWN_IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

async function ensureMermaidInitialized() {
  if (mermaidReady) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
  });
  mermaidReady = true;
}

async function renderMermaidSvg(code: string, index: number) {
  await ensureMermaidInitialized();
  const { svg } = await mermaid.render(`export-mermaid-${index}`, code);
  return svg;
}

async function svgToPngBytes(svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("Failed to render Mermaid image"));
      next.src = url;
    });
    const width = Math.max(Math.ceil(image.naturalWidth || image.width || 800), 1);
    const height = Math.max(Math.ceil(image.naturalHeight || image.height || 400), 1);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas rendering is unavailable");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) {
      throw new Error("Failed to encode Mermaid PNG");
    }
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageUrlToPngBytes(src: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    next.src = src;
  });

  const width = Math.max(Math.ceil(image.naturalWidth || image.width || 800), 1);
  const height = Math.max(Math.ceil(image.naturalHeight || image.height || 400), 1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas rendering is unavailable");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!pngBlob) {
    throw new Error("Failed to encode image PNG");
  }
  return new Uint8Array(await pngBlob.arrayBuffer());
}

async function resolveMarkdownImageToPng(src: string, docPath?: string) {
  const resolved = resolveImageSource(src, docPath, {
    isTauriApp: false,
  });
  return imageUrlToPngBytes(resolved);
}

function parseStandaloneMarkdownImage(text: string) {
  const match = text.trim().match(MARKDOWN_IMAGE_RE);
  if (!match) {
    return null;
  }
  return {
    alt: match[1] ?? "",
    src: match[2] ?? "",
  };
}

function pushListItems(
  blocks: WordBlock[],
  items: Array<{ text: string; number?: number; tokens?: unknown[] }>,
  ordered: boolean,
  level = 0,
) {
  for (const item of items) {
    blocks.push({
      type: "listItem",
      ordered,
      level,
      number: item.number,
      text: normalizeText(stripTags(item.text)),
    });

    for (const child of item.tokens ?? []) {
      if (
        child &&
        typeof child === "object" &&
        "type" in child &&
        child.type === "list" &&
        "items" in child &&
        Array.isArray(child.items)
      ) {
        pushListItems(
          blocks,
          child.items as Array<{ text: string; number?: number; tokens?: unknown[] }>,
          Boolean("ordered" in child && child.ordered),
          level + 1,
        );
      }
    }
  }
}

export async function markdownToWordPayload(
  markdown: string,
  options?: { includeMermaidCode?: boolean; title?: string; docPath?: string },
) {
  const blocks: WordBlock[] = [];
  const tokens = marked.lexer(markdown);
  const includeMermaidCode = options?.includeMermaidCode ?? false;

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        blocks.push({
          type: "heading",
          level: token.depth,
          text: normalizeText(stripTags(token.text)),
        });
        break;
      case "paragraph": {
        const standaloneImage =
          parseStandaloneMarkdownImage(token.text) ??
          (Array.isArray(token.tokens) &&
          token.tokens.length === 1 &&
          token.tokens[0]?.type === "image" &&
          typeof token.tokens[0].href === "string"
            ? {
                alt: token.tokens[0].text ?? "",
                src: token.tokens[0].href,
              }
            : null);
        if (standaloneImage) {
          try {
            const png = await resolveMarkdownImageToPng(standaloneImage.src, options?.docPath);
            blocks.push({
              type: "image",
              alt: standaloneImage.alt,
              png,
            });
            break;
          } catch {
            // Fall back to plain markdown text if the image cannot be resolved.
          }
        }
        blocks.push({
          type: "paragraph",
          text: normalizeText(stripTags(token.text)),
        });
        break;
      }
      case "space":
        break;
      case "code": {
        const language = (token.lang ?? "").trim().toLowerCase();
        if (language === "mermaid") {
          const code = token.text;
          try {
            const svg = await renderMermaidSvg(code, blocks.length);
            const png = await svgToPngBytes(svg);
            blocks.push({ type: "mermaid", code, png });
            if (includeMermaidCode) {
              blocks.push({ type: "code", language: "mermaid", text: code });
            }
          } catch {
            blocks.push({ type: "code", language: "mermaid", text: code });
          }
          break;
        }
        blocks.push({
          type: "code",
          language,
          text: token.text,
        });
        break;
      }
      case "list":
        pushListItems(blocks, token.items, token.ordered);
        break;
      case "table":
        blocks.push({
          type: "table",
          headerRowCount: token.header.length > 0 ? 1 : 0,
          rows: [
            token.header.map((cell) => normalizeText(stripTags(cell.text))),
            ...token.rows.map((row) => row.map((cell) => normalizeText(stripTags(cell.text)))),
          ],
        });
        break;
      case "blockquote":
        for (const item of token.tokens ?? []) {
          if (item.type === "paragraph") {
            blocks.push({
              type: "blockquote",
              text: normalizeText(stripTags(item.text)),
            });
          }
        }
        break;
      default:
        if ("text" in token && typeof token.text === "string") {
          const text = normalizeText(stripTags(token.text));
          if (text) {
            blocks.push({ type: "paragraph", text });
          }
        }
        break;
    }
  }

  return {
    title: options?.title ?? "Document",
    blocks: blocks.filter((block) => {
      if (block.type === "paragraph" || block.type === "heading" || block.type === "code") {
        return block.text.length > 0;
      }
      return true;
    }),
  } satisfies WordExportPayload;
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function buildRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function buildDocumentRelsXml(payload: WordExportPayload) {
  const imageBlocks = payload.blocks.filter(
    (block): block is Extract<WordBlock, { type: "mermaid" | "image" }> =>
      block.type === "mermaid" || block.type === "image",
  );
  const lines = [
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    `<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`,
    ...imageBlocks.map(
      (_block, index) =>
        `<Relationship Id="rIdImage${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image-${index + 1}.png"/>`,
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${lines.join("\n  ")}
</Relationships>`;
}

type WordInlineStyle = {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
};

type MarkedInlineToken = {
  type: string;
  text?: string;
  raw?: string;
  tokens?: MarkedInlineToken[];
};

function mergeInlineStyle(base: WordInlineStyle, extra: WordInlineStyle): WordInlineStyle {
  return {
    bold: base.bold || extra.bold || undefined,
    italic: base.italic || extra.italic || undefined,
    strike: base.strike || extra.strike || undefined,
    code: base.code || extra.code || undefined,
  };
}

function buildRunProperties(style: WordInlineStyle) {
  const properties = [
    style.bold ? "<w:b/>" : "",
    style.italic ? "<w:i/>" : "",
    style.strike ? "<w:strike/>" : "",
    style.code ? '<w:rFonts w:ascii="Menlo" w:hAnsi="Menlo"/><w:sz w:val="20"/>' : "",
  ].join("");
  return properties ? `<w:rPr>${properties}</w:rPr>` : "";
}

function textRun(text: string, style: WordInlineStyle = {}) {
  const lines = text.split("\n");
  const runProperties = buildRunProperties(style);
  return lines
    .map((line, index) => {
      const space = /^\s|\s$/.test(line) ? ' xml:space="preserve"' : "";
      const run = `<w:r>${runProperties}<w:t${space}>${escapeXml(line)}</w:t></w:r>`;
      if (index === lines.length - 1) {
        return run;
      }
      return `${run}<w:r><w:br/></w:r>`;
    })
    .join("");
}

function inlineTokensToRuns(tokens: MarkedInlineToken[], inheritedStyle: WordInlineStyle = {}) {
  return tokens.map((token) => inlineTokenToRuns(token, inheritedStyle)).join("");
}

function inlineTokenToRuns(token: MarkedInlineToken, inheritedStyle: WordInlineStyle): string {
  switch (token.type) {
    case "strong":
      return inlineTokensToRuns(token.tokens ?? [], mergeInlineStyle(inheritedStyle, { bold: true }));
    case "em":
      return inlineTokensToRuns(token.tokens ?? [], mergeInlineStyle(inheritedStyle, { italic: true }));
    case "del":
      return inlineTokensToRuns(token.tokens ?? [], mergeInlineStyle(inheritedStyle, { strike: true }));
    case "codespan":
      return textRun(token.text ?? "", mergeInlineStyle(inheritedStyle, { code: true }));
    case "link":
      return inlineTokensToRuns(token.tokens ?? [], inheritedStyle);
    case "br":
      return "<w:r><w:br/></w:r>";
    case "html":
      return textRun(stripTags(token.raw ?? token.text ?? ""), inheritedStyle);
    case "text":
    case "escape":
      return textRun(token.text ?? "", inheritedStyle);
    default:
      if (Array.isArray(token.tokens) && token.tokens.length > 0) {
        return inlineTokensToRuns(token.tokens, inheritedStyle);
      }
      return textRun(token.text ?? "", inheritedStyle);
  }
}

function richParagraphRuns(text: string) {
  const tokens = marked.Lexer.lexInline(text) as MarkedInlineToken[];
  return inlineTokensToRuns(tokens);
}

function buildTableCellXml(text: string, isHeader: boolean) {
  const paragraph = isHeader
    ? `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`
    : `<w:p>${text ? richParagraphRuns(text) : "<w:r><w:t></w:t></w:r>"}</w:p>`;
  return `<w:tc>
  <w:tcPr>
    <w:tcW w:w="0" w:type="auto"/>
  </w:tcPr>
  ${paragraph}
</w:tc>`;
}

function buildTableXml(rows: string[][], headerRowCount: number) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row.map((cell) => buildTableCellXml(cell, rowIndex < headerRowCount)).join("");
      return `<w:tr>${cells}</w:tr>`;
    })
    .join("");

  return `<w:tbl>
  <w:tblPr>
    <w:tblBorders>
      <w:top w:val="single" w:sz="8" w:space="0" w:color="auto"/>
      <w:left w:val="single" w:sz="8" w:space="0" w:color="auto"/>
      <w:bottom w:val="single" w:sz="8" w:space="0" w:color="auto"/>
      <w:right w:val="single" w:sz="8" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="8" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="8" w:space="0" w:color="auto"/>
    </w:tblBorders>
  </w:tblPr>
  ${rowXml}
</w:tbl>`;
}

function buildListItemXml(block: Extract<WordBlock, { type: "listItem" }>) {
  const indentLeft = 720 * (block.level + 1);
  const numbering = block.ordered
    ? `<w:numPr><w:ilvl w:val="${block.level}"/><w:numId w:val="2"/></w:numPr>`
    : `<w:numPr><w:ilvl w:val="${block.level}"/><w:numId w:val="1"/></w:numPr>`;
  return `<w:p>
  <w:pPr>
    ${numbering}
    <w:ind w:left="${indentLeft}" w:hanging="360"/>
  </w:pPr>
  ${richParagraphRuns(block.text)}
</w:p>`;
}

function buildBlockquoteXml(text: string) {
  return `<w:p>
  <w:pPr>
    <w:ind w:left="720"/>
    <w:spacing w:before="120" w:after="120"/>
    <w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>
  </w:pPr>
  ${richParagraphRuns(text)}
</w:p>`;
}

function buildDocumentXml(payload: WordExportPayload) {
  let imageIndex = 0;
  const body = payload.blocks
    .map((block) => {
      if (block.type === "heading") {
        const style = `Heading${Math.min(Math.max(block.level, 1), 6)}`;
        return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${richParagraphRuns(block.text)}</w:p>`;
      }

      if (block.type === "paragraph") {
        return `<w:p>${richParagraphRuns(block.text)}</w:p>`;
      }

      if (block.type === "listItem") {
        return buildListItemXml(block);
      }

      if (block.type === "blockquote") {
        return buildBlockquoteXml(block.text);
      }

      if (block.type === "code") {
        return `<w:p><w:r><w:rPr><w:rFonts w:ascii="Menlo" w:hAnsi="Menlo"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(block.language ? `[${block.language}]\n${block.text}` : block.text)}</w:t></w:r></w:p>`;
      }

      if (block.type === "table") {
        return buildTableXml(block.rows, block.headerRowCount);
      }

      imageIndex += 1;
      const relId = `rIdImage${imageIndex}`;
      const name = block.type === "mermaid" ? `Mermaid ${imageIndex}` : (block.alt || `Image ${imageIndex}`);
      return `<w:p>
  <w:r>
    <w:drawing>
      <wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="5486400" cy="3088800"/>
        <wp:docPr id="${imageIndex}" name="${escapeXml(name)}"/>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="${imageIndex}" name="${escapeXml(name)}.png"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="3088800"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;
}

function buildNumberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="multilevel"/>
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/><w:lvlJc w:val="left"/></w:lvl>
    <w:lvl w:ilvl="2"><w:numFmt w:val="bullet"/><w:lvlText w:val="▪"/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="2">
    <w:multiLevelType w:val="multilevel"/>
    <w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2."/><w:lvlJc w:val="left"/></w:lvl>
    <w:lvl w:ilvl="2"><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%3."/><w:lvlJc w:val="left"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;
}

function buildCoreXml(title: string) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>make-md</dc:creator>
  <cp:lastModifiedBy>make-md</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function buildAppXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>make-md</Application>
</Properties>`;
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = createCrcTable();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function concatArrays(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function zipStore(files: Array<{ name: string; data: Uint8Array }>) {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encodeUtf8(file.name);
    const crc = crc32(file.data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localChunks.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);

    offset += localHeader.length + file.data.length;
  }

  const centralDirectory = concatArrays(centralChunks);
  const locals = concatArrays(localChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, locals.length, true);
  endView.setUint16(20, 0, true);

  return concatArrays([locals, centralDirectory, end]);
}

export function wordPayloadToDocxBytes(payload: WordExportPayload) {
  const imageBlocks = payload.blocks.filter(
    (block): block is Extract<WordBlock, { type: "mermaid" | "image" }> =>
      block.type === "mermaid" || block.type === "image",
  );
  const files = [
    { name: "[Content_Types].xml", data: encodeUtf8(buildContentTypesXml()) },
    { name: "_rels/.rels", data: encodeUtf8(buildRelsXml()) },
    { name: "docProps/core.xml", data: encodeUtf8(buildCoreXml(payload.title)) },
    { name: "docProps/app.xml", data: encodeUtf8(buildAppXml()) },
    { name: "word/document.xml", data: encodeUtf8(buildDocumentXml(payload)) },
    { name: "word/styles.xml", data: encodeUtf8(buildStylesXml()) },
    { name: "word/numbering.xml", data: encodeUtf8(buildNumberingXml()) },
    { name: "word/_rels/document.xml.rels", data: encodeUtf8(buildDocumentRelsXml(payload)) },
    ...imageBlocks.map((block, index) => ({
      name: `word/media/image-${index + 1}.png`,
      data: block.png,
    })),
  ];

  return zipStore(files);
}

export async function exportMarkdownToWord(markdown: string, title: string, defaultPath?: string, docPath?: string) {
  const selection = await pickSaveWordFile(defaultPath);
  if (!selection) {
    return null;
  }
  const payload = await markdownToWordPayload(markdown, {
    includeMermaidCode: selection.includeMermaidCode,
    title,
    docPath,
  });
  const bytes = wordPayloadToDocxBytes(payload);
  await writeBinaryFile(selection.path, Array.from(bytes));
  return selection.path;
}
