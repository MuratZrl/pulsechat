// Unread counts now come from the API (Room.unreadCount).
// Marking a room as read calls POST /api/rooms/:id/read.
// This file is kept as a no-op shim so existing imports don't break.

export function getLastRead(_roomId: string): string | null {
  return null;
}

export function setLastRead(_roomId: string, _timestamp: string) {
  // no-op: handled server-side via POST /rooms/:id/read
}

export function getUnreadCount(_roomId: string): number {
  return 0; // real counts come from Room.unreadCount in the API response
}
