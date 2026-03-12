/**
 * Room roles — in-memory cache (no localStorage).
 * Populated by page.tsx when a room is loaded via getRoom() API.
 * The API returns all members with their roles, so this cache is always fresh per room visit.
 */
export type RoomRole = "admin" | "moderator" | "member";

// roomId → (userId → role)
const cache = new Map<string, Map<string, RoomRole>>();

/** Called by page.tsx after fetching room data from the API */
export function setRoomRoles(
  roomId: string,
  members: { userId: string; role: string }[]
): void {
  const map = new Map<string, RoomRole>();
  for (const m of members) {
    map.set(m.userId, m.role as RoomRole);
  }
  cache.set(roomId, map);
}

export function getUserRole(roomId: string, userId: string): RoomRole {
  return (cache.get(roomId)?.get(userId) ?? "member") as RoomRole;
}

export function canDeleteMessage(
  roomId: string,
  userId: string,
  messageOwnerId: string
): boolean {
  if (userId === messageOwnerId) return true;
  const role = getUserRole(roomId, userId);
  return role === "admin" || role === "moderator";
}

export function canPinMessage(roomId: string, userId: string): boolean {
  const role = getUserRole(roomId, userId);
  return role === "admin" || role === "moderator";
}

export function canManageRoles(roomId: string, userId: string): boolean {
  return getUserRole(roomId, userId) === "admin";
}

export function canInvite(roomId: string, userId: string): boolean {
  const role = getUserRole(roomId, userId);
  return role === "admin" || role === "moderator";
}

export function getRoomRoles(roomId: string): Record<string, RoomRole> {
  const map = cache.get(roomId);
  if (!map) return {};
  return Object.fromEntries(map.entries());
}
