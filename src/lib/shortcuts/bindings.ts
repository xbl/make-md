const KEY_ALIASES: Record<string, string> = {
  " ": "Space",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Backspace: "Backspace",
  Tab: "Tab",
  Escape: "Escape",
  "`": "Backquote",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  "/": "Slash",
  "=": "Equal",
  "-": "Minus",
  ",": "Comma",
  ".": "Period",
};

function normalizeKey(key: string): string | null {
  if (key.length === 1) {
    if (/[a-z]/i.test(key)) {
      return key.toLowerCase();
    }
    return KEY_ALIASES[key] ?? key;
  }

  return KEY_ALIASES[key] ?? key;
}

export function eventToChord(event: KeyboardEvent): string | null {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod && event.key !== "F8" && event.key !== "F9") {
    return null;
  }

  const parts: string[] = [];

  if (event.ctrlKey) {
    parts.push("Ctrl");
  }
  if (event.metaKey) {
    parts.push("Mod");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }

  const key = normalizeKey(event.key);
  if (!key || key === "Control" || key === "Meta" || key === "Alt" || key === "Shift") {
    return null;
  }

  parts.push(key);
  return parts.join("-");
}

export function matchesChord(event: KeyboardEvent, chord: string): boolean {
  const parsed = eventToChord(event);
  if (!parsed) {
    return false;
  }

  if (parsed === chord) {
    return true;
  }

  // Treat Mod as meta on macOS and ctrl elsewhere for matching stored chords.
  const alt = parsed.replace(/^Mod-/, "Ctrl-").replace(/-Mod-/g, "-Ctrl-");
  const altChord = chord.replace(/^Mod-/, "Ctrl-").replace(/-Mod-/g, "-Ctrl-");
  return alt === altChord || parsed.replace(/Mod/g, "Ctrl") === chord.replace(/Mod/g, "Ctrl");
}

export function parseChord(chord: string): {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
} {
  const parts = chord.split("-");
  const key = parts[parts.length - 1] ?? "";
  return {
    ctrl: parts.includes("Ctrl"),
    meta: parts.includes("Mod"),
    alt: parts.includes("Alt"),
    shift: parts.includes("Shift"),
    key,
  };
}
