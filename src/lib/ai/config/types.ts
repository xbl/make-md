export type AiSkill = {
  name: string;
  description: string;
  globs: string[];
  body: string;
};

export type AiSkillMatchInput = {
  filePath: string;
  previewText: string;
};
