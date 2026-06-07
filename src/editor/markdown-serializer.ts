import type { Node as PMNode } from "prosemirror-model";

function eachChild(node: PMNode, mapper: (child: PMNode) => string) {
  const output: string[] = [];
  for (let index = 0; index < node.childCount; index += 1) {
    output.push(mapper(node.child(index)));
  }
  return output;
}

function serializeList(node: PMNode): string {
  return eachChild(node, (item) => {
    const paragraph = item.firstChild;
    return `- ${paragraph ? paragraph.textContent : ""}`;
  }).join("\n");
}

export function serializeMarkdown(doc: PMNode): string {
  const blocks = eachChild(doc, (node) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level ?? 1;
      return `${"#".repeat(level)} ${node.textContent}`;
    }
    if (node.type.name === "bullet_list") {
      return serializeList(node);
    }
    if (node.type.name === "code_block") {
      const lang = node.attrs.params ?? "";
      return `\`\`\`${lang}\n${node.textContent}\n\`\`\``;
    }
    return node.textContent;
  });

  return blocks.join("\n\n");
}
