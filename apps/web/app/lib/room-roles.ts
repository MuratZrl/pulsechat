export type RoomRole = "admin" | "moderator" | "member";

const ROLES_KEY = "chat_room_roles";

// Default: system rooms have user-mock-1 as admin
const DEFAULT_ROLES: Record<string, Record<string, RoomRole>> = {
  "room-1": { "user-mock-1": "admin", "user-mock-2": "moderator" },
  "room-2": { "user-mock-1": "admin" },
};

function loadRoles(): Record<string, Record<string, RoomRole>> {
  if (typeof window === "undefined") return DEFAULT_ROLES;
  const stored = localStorage.getItem(ROLES_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_ROLES;
}

function saveRoles(roles: Record<string, Record<string, RoomRole>>) {
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
}

export function getUserRole(roomId: string, userId: string): RoomRole {
  const roles = loadRoles();
  return roles[roomId]?.[userId] || "member";
}

export function setUserRole(
  roomId: string,
  userId: string,
  role: RoomRole
): void {
  const roles = loadRoles();
  if (!roles[roomId]) roles[roomId] = {};
  roles[roomId][userId] = role;
  saveRoles(roles);
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

export function getRoomRoles(
  roomId: string
): Record<string, RoomRole> {
  const roles = loadRoles();
  return roles[roomId] || {};
}
