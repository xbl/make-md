const DISPLAY_KEY: Record<string, string> = {
  Backquote: "`",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Slash: "/",
  Equal: "=",
  Minus: "-",
  Comma: ",",
  Period: ".",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

function formatKey(key: string, platform: string): string {
  if (DISPLAY_KEY[key]) {
    return DISPLAY_KEY[key];
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key;
}

export function chordToDisplay(chord: string, platform = "darwin"): string {
  const parts = chord.split("-");
  const key = parts.pop() ?? "";
  const symbols: string[] = [];

  for (const part of parts) {
    switch (part) {
      case "Mod":
        symbols.push(platform === "darwin" ? "⌘" : "Ctrl+");
        break;
      case "Ctrl":
        symbols.push(platform === "darwin" ? "⌃" : "Ctrl+");
        break;
      case "Alt":
        symbols.push(platform === "darwin" ? "⌥" : "Alt+");
        break;
      case "Shift":
        symbols.push(platform === "darwin" ? "⇧" : "Shift+");
        break;
      default:
        symbols.push(`${part}+`);
    }
  }

  if (platform === "darwin") {
    return `${symbols.join("")}${formatKey(key, platform)}`;
  }

  return `${symbols.join("")}${formatKey(key, platform)}`.replace(/\+\+/g, "+").replace(/\+$/, "");
}
