import { getMessages } from "./mock-data";

const LAST_READ_KEY = "chat_last_read";

function getLastReadMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(LAST_READ_KEY);
  return stored ? JSON.parse(stored) : {};
}

function saveLastReadMap(map: Record<string, string>) {
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(map));
}

export function getLastRead(roomId: string): string | null {
  return getLastReadMap()[roomId] || null;
}

export function setLastRead(roomId: string, timestamp: string) {
  const map = getLastReadMap();
  map[roomId] = timestamp;
  saveLastReadMap(map);
}

export function getUnreadCount(roomId: string): number {
  const lastRead = getLastRead(roomId);
  if (!lastRead) {
    // Never visited — all messages are unread
    return getMessages(roomId).length;
  }
  return getMessages(roomId).filter((m) => m.createdAt > lastRead).length;
}
