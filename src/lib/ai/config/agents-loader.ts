export function mergeAgentsContent(projectContent: string | null, globalContent: string | null) {
  return [projectContent, globalContent].filter(Boolean).join("\n\n");
}
