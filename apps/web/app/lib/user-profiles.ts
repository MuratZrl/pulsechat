import { UserProfile } from "../types";

const MOCK_PROFILES: Record<string, Omit<UserProfile, "status">> = {
  "user-mock-1": {
    id: "user-mock-1",
    name: "Alice",
    email: "alice@example.com",
    bio: "Full-stack engineer. Coffee enthusiast.",
    joinedAt: "2024-06-15T00:00:00.000Z",
  },
  "user-mock-2": {
    id: "user-mock-2",
    name: "Bob",
    email: "bob@example.com",
    bio: "UI/UX Designer. Pixel perfectionist.",
    joinedAt: "2024-07-20T00:00:00.000Z",
  },
  "user-mock-3": {
    id: "user-mock-3",
    name: "Charlie",
    email: "charlie@example.com",
    bio: "DevOps wizard. Automates everything.",
    joinedAt: "2024-08-01T00:00:00.000Z",
  },
  "user-mock-4": {
    id: "user-mock-4",
    name: "Diana",
    email: "diana@example.com",
    bio: "Product manager. Loves roadmaps.",
    joinedAt: "2024-09-10T00:00:00.000Z",
  },
};

function getRegisteredUser(userId: string): Omit<UserProfile, "status"> | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("chat_users");
  if (!stored) return null;
  const users = JSON.parse(stored);
  const found = users.find((u: { id: string }) => u.id === userId);
  if (!found) return null;
  return {
    id: found.id,
    name: found.name,
    email: found.email,
    bio: found.bio || "Chat member",
    avatarUrl: found.avatarUrl || undefined,
    joinedAt: found.joinedAt || new Date().toISOString(),
  };
}

export function getUserProfile(
  userId: string,
  name: string,
  status: "online" | "idle" | "offline" = "offline"
): UserProfile {
  const mock = MOCK_PROFILES[userId];
  if (mock) {
    return { ...mock, status };
  }
  const registered = getRegisteredUser(userId);
  if (registered) {
    return { ...registered, status };
  }
  return {
    id: userId,
    name,
    bio: "Chat member",
    joinedAt: new Date().toISOString(),
    status,
  };
}
