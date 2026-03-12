const STORAGE_KEY = "chat_pinned_messages";

function getAll(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveAll(data: Record<string, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getPinnedMessageIds(roomId: string): string[] {
  return getAll()[roomId] || [];
}

export function togglePin(roomId: string, messageId: string): string[] {
  const all = getAll();
  const pins = all[roomId] || [];
  const index = pins.indexOf(messageId);
  if (index >= 0) {
    pins.splice(index, 1);
  } else {
    pins.push(messageId);
  }
  if (pins.length === 0) {
    delete all[roomId];
  } else {
    all[roomId] = pins;
  }
  saveAll(all);
  return pins;
}

export function isPinned(roomId: string, messageId: string): boolean {
  return getPinnedMessageIds(roomId).includes(messageId);
}
