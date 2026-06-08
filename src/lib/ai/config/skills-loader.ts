import type { AiSkill } from "@/lib/ai/config/types";

export function parseSkillDocument(source: string): AiSkill {
  const match = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/m.exec(source.trim());
  if (!match) {
    return {
      name: "unknown",
      description: "",
      globs: [],
      body: source.trim(),
    };
  }

  const [, rawFrontmatter, body] = match;
  const fields = new Map<string, string>();
  for (const line of rawFrontmatter.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields.set(key, value);
  }

  const globs = (fields.get("globs") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    name: fields.get("name") ?? "unknown",
    description: fields.get("description") ?? "",
    globs,
    body: body.trim(),
  };
}
