export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: string;
  category: "Navigation" | "Panels" | "Actions";
}

export const SHORTCUTS: Shortcut[] = [
  {
    key: "k",
    ctrl: true,
    description: "Search rooms",
    action: "focus-room-search",
    category: "Navigation",
  },
  {
    key: "Escape",
    description: "Close panel / modal",
    action: "close-all",
    category: "Navigation",
  },
  {
    key: "/",
    ctrl: true,
    description: "Show keyboard shortcuts",
    action: "show-shortcuts",
    category: "Actions",
  },
  {
    key: "m",
    ctrl: true,
    shift: true,
    description: "Toggle members panel",
    action: "toggle-members",
    category: "Panels",
  },
  {
    key: "f",
    ctrl: true,
    shift: true,
    description: "Toggle search bar",
    action: "toggle-search",
    category: "Panels",
  },
  {
    key: "s",
    ctrl: true,
    shift: true,
    description: "Toggle starred messages",
    action: "toggle-starred",
    category: "Panels",
  },
];

export function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key === "Escape" ? "Esc" : shortcut.key.toUpperCase());
  return parts.join(" + ");
}
