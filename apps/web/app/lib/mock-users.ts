export type UserStatus = "online" | "idle" | "offline";

export interface OnlineUser {
  id: string;
  name: string;
  status: UserStatus;
}

const mockUsers: OnlineUser[] = [
  { id: "user-mock-1", name: "Alice", status: "online" },
  { id: "user-mock-2", name: "Bob", status: "online" },
  { id: "user-mock-3", name: "Charlie", status: "idle" },
  { id: "user-mock-4", name: "Diana", status: "offline" },
];

export function getOnlineUsers(
  roomId: string,
  currentUser?: { id: string; name: string }
): OnlineUser[] {
  // Different rooms have slightly different user lists
  const roomUsers =
    roomId === "room-1"
      ? mockUsers
      : mockUsers.filter((u) => u.id !== "user-mock-4");

  if (currentUser) {
    const withoutCurrent = roomUsers.filter((u) => u.id !== currentUser.id);
    return [
      { id: currentUser.id, name: currentUser.name, status: "online" },
      ...withoutCurrent,
    ];
  }

  return roomUsers;
}
