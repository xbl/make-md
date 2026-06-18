import { tool } from "ai";
import { z } from "zod";

export const webSearch = tool({
  description:
    "Search the web for current information. Returns page titles and snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }: { query: string }) => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ status: number; body: string }>("fetch_url", { url });
    if (result.status >= 400) {
      return { error: `Search failed: HTTP ${result.status}`, results: [] };
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.body, "text/html");
    const entries = Array.from(doc.querySelectorAll(".result")).slice(0, 8);
    const results = entries.map((el) => {
      const title = el.querySelector(".result__title")?.textContent?.trim() ?? "";
      const snippet = el.querySelector(".result__snippet")?.textContent?.trim() ?? "";
      const link = el.querySelector(".result__url")?.textContent?.trim() ?? "";
      return { title, snippet, link };
    });
    return { results, query };
  },
});

export const webFetch = tool({
  description:
    "Fetch and extract text content from a URL.",
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch"),
  }),
  execute: async ({ url }: { url: string }) => {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ status: number; body: string; error: string | null }>(
      "fetch_url",
      { url },
    );
    if (result.error || result.status >= 400) {
      return { error: result.error ?? `HTTP ${result.status}`, content: "" };
    }
    const text = stripHtml(result.body).slice(0, 8000);
    return { content: text, url };
  },
});

function stripHtml(html: string): string {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
