const STARRED_KEY = "chat_starred_messages";

interface StarredEntry {
  messageId: string;
  roomId: string;
  starredAt: string;
}

function loadStarred(): StarredEntry[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STARRED_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveStarred(entries: StarredEntry[]) {
  localStorage.setItem(STARRED_KEY, JSON.stringify(entries));
}

export function toggleStarred(messageId: string, roomId: string): boolean {
  const entries = loadStarred();
  const index = entries.findIndex((e) => e.messageId === messageId);

  if (index >= 0) {
    entries.splice(index, 1);
    saveStarred(entries);
    return false;
  } else {
    entries.push({ messageId, roomId, starredAt: new Date().toISOString() });
    saveStarred(entries);
    return true;
  }
}

export function isStarred(messageId: string): boolean {
  return loadStarred().some((e) => e.messageId === messageId);
}

export function getStarredMessageIds(): string[] {
  return loadStarred().map((e) => e.messageId);
}

export function getStarredEntries(): StarredEntry[] {
  return loadStarred();
}
