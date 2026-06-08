import type { AiSkill, AiSkillMatchInput } from "@/lib/ai/config/types";

export function scoreSkillMatch(skill: Pick<AiSkill, "description" | "globs">, input: AiSkillMatchInput) {
  let score = 0;

  if (skill.globs.some((glob) => input.filePath.startsWith(glob.replace("/**", "/").replace("*", "")))) {
    score += 10;
  }

  for (const word of skill.description.toLowerCase().split(/\s+/)) {
    if (word && input.previewText.toLowerCase().includes(word)) {
      score += 1;
    }
  }

  return score;
}
