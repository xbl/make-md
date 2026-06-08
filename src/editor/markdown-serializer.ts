import { markdownSchema } from "@/editor/schema";
import type { Node as PMNode } from "prosemirror-model";

function eachChild(node: PMNode, mapper: (child: PMNode) => string) {
  const output: string[] = [];
  for (let index = 0; index < node.childCount; index += 1) {
    output.push(mapper(node.child(index)));
  }
  return output;
}

function serializeInline(node: PMNode): string {
  if (node.type.name === "hard_break") {
    return "<br>";
  }
  if (node.isText) {
    let text = node.text ?? "";
    const { marks } = markdownSchema;
    const linkMark = marks.link.isInSet(node.marks);
    if (linkMark) {
      return `[${text}](${linkMark.attrs.href ?? ""})`;
    }
    if (marks.code.isInSet(node.marks)) {
      return `\`${text}\``;
    }
    if (marks.strike?.isInSet(node.marks)) {
      return `~~${text}~~`;
    }
    if (marks.strong.isInSet(node.marks)) {
      return `**${text}**`;
    }
    if (marks.em.isInSet(node.marks)) {
      return `*${text}*`;
    }
    return text;
  }
  if (node.type.name === "image") {
    return `![${node.attrs.alt ?? ""}](${node.attrs.src ?? ""})`;
  }
  let output = "";
  for (let index = 0; index < node.childCount; index += 1) {
    output += serializeInline(node.child(index));
  }
  return output;
}

function serializeInlineContent(node: PMNode): string {
  let output = "";
  for (let index = 0; index < node.childCount; index += 1) {
    output += serializeInline(node.child(index));
  }
  return output;
}

function serializeParagraph(node: PMNode): string {
  return serializeInlineContent(node);
}

function serializeBulletList(node: PMNode): string {
  return eachChild(node, (item) => {
    const paragraph = item.firstChild;
    return `- ${paragraph ? serializeParagraph(paragraph) : ""}`;
  }).join("\n");
}

function serializeOrderedList(node: PMNode): string {
  const output: string[] = [];
  for (let index = 0; index < node.childCount; index += 1) {
    const item = node.child(index);
    const paragraph = item.firstChild;
    output.push(`${index + 1}. ${paragraph ? serializeParagraph(paragraph) : ""}`);
  }
  return output.join("\n");
}

function serializeTaskList(node: PMNode): string {
  return eachChild(node, (item) => {
    const checked = item.attrs.checked ? "x" : " ";
    const paragraph = item.firstChild;
    return `- [${checked}] ${paragraph ? serializeParagraph(paragraph) : ""}`;
  }).join("\n");
}

function serializeTableCell(cell: PMNode): string {
  if (cell.childCount === 0) {
    return "";
  }
  return serializeBlock(cell.child(0));
}

function serializeTable(node: PMNode): string {
  const rows = eachChild(node, (row) => {
    const cells = eachChild(row, (cell) => serializeTableCell(cell));
    return `| ${cells.join(" | ")} |`;
  });
  if (rows.length === 0) {
    return "";
  }
  const separator = `| ${rows[0]
    .split("|")
    .slice(1, -1)
    .map(() => "---")
    .join(" | ")} |`;
  return [rows[0], separator, ...rows.slice(1)].join("\n");
}

function serializeBlock(node: PMNode): string {
  if (node.type.name === "heading") {
    const level = node.attrs.level ?? 1;
    return `${"#".repeat(level)} ${serializeInlineContent(node)}`;
  }
  if (node.type.name === "bullet_list") {
    return serializeBulletList(node);
  }
  if (node.type.name === "ordered_list") {
    return serializeOrderedList(node);
  }
  if (node.type.name === "task_list") {
    return serializeTaskList(node);
  }
  if (node.type.name === "blockquote") {
    return eachChild(node, (child) => `> ${serializeBlock(child)}`).join("\n");
  }
  if (node.type.name === "code_block") {
    const lang = node.attrs.params ?? "";
    return `\`\`\`${lang}\n${node.textContent}\n\`\`\``;
  }
  if (node.type.name === "horizontal_rule") {
    return "---";
  }
  if (node.type.name === "table") {
    return serializeTable(node);
  }
  if (node.type.name === "paragraph") {
    return serializeParagraph(node);
  }
  return node.textContent;
}

export function serializeMarkdown(doc: PMNode): string {
  const blocks = eachChild(doc, serializeBlock);
  return blocks.join("\n\n");
}
