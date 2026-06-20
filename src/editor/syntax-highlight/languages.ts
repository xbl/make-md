import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import markdown from "highlight.js/lib/languages/markdown";
import yaml from "highlight.js/lib/languages/yaml";

const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  html: "xml",
  yml: "yaml",
};

let registered = false;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ensureHighlightLanguagesRegistered() {
  if (registered) {
    return;
  }

  for (const lang of [javascript, typescript, python, rust, bash, json, xml, css, markdown, yaml]) {
    hljs.registerLanguage(lang.name, lang);
  }

  registered = true;
}

export function resolveHighlightLanguage(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (!trimmed) {
    return "plaintext";
  }

  const mapped = ALIASES[trimmed] ?? trimmed;
  ensureHighlightLanguagesRegistered();
  return hljs.getLanguage(mapped) ? mapped : "plaintext";
}

export function isMermaidLanguage(raw: string | null | undefined): boolean {
  return (raw ?? "").trim().toLowerCase() === "mermaid";
}

export function highlightCode(text: string, language: string): string {
  ensureHighlightLanguagesRegistered();
  const resolvedLanguage = language.trim() ? language : "plaintext";

  try {
    if (resolvedLanguage === "plaintext") {
      return hljs.highlightAuto(text).value;
    }
    return hljs.highlight(text, { language: resolvedLanguage }).value;
  } catch {
    return escapeHtml(text);
  }
}

export { hljs };
