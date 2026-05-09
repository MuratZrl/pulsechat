export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  // Avatar fields are populated by /auth/me and PATCH /users/me. They are
  // absent on the user object returned by /auth/login and /auth/register
  // (those endpoints don't select them yet) — callers that need them on
  // login should rely on the subsequent /auth/me call instead.
  avatarUrl?: string | null;
  avatarPreset?: string | null;
}

export type UserStatus = "online" | "idle" | "offline";

export interface OnlineUser {
  id: string;
  name: string;
  status: UserStatus;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
}

export interface Room {
  id: string;
  name: string;
  type?: "CHANNEL" | "DM";
  createdBy: string;
  createdAt: string;
  unreadCount?: number;
  mentionCount?: number;
  lastMessageAt?: string | null;
}

export interface Attachment {
  name: string;
  type: "image" | "file" | "voice";
  size: string;
  url?: string;
  duration?: number;
}

export interface ReplyPreview {
  id: string;
  text: string;
  senderName: string;
  // Avatar fields are flat (mirroring Message.senderAvatar*) so render sites
  // can pipe them into <Avatar> the same way as on the parent bubble.
  senderAvatarUrl?: string | null;
  senderAvatarPreset?: string | null;
  attachment?: Attachment;
  mentions?: Array<{ userId: string; userName: string }>;
}

export type Reactions = Record<string, string[]>; // emoji -> userIds[]

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  // Sender avatar fields. Flat alongside senderName because the wire format
  // is additive — older clients without these fields still work, and the
  // shared <Avatar> falls back to colored initials when both are nullish.
  senderAvatarUrl?: string | null;
  senderAvatarPreset?: string | null;
  text: string;
  createdAt: string;
  editedAt?: string;
  isDeleted?: boolean;
  replyToId?: string;
  replyTo?: ReplyPreview;
  attachment?: Attachment;
  mentions?: Array<{ userId: string; userName: string }>;
  forwarded?: {
    originalSender: string;
    originalRoom: string;
  };
  reactions?: Reactions;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  bio: string;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
  status: "online" | "idle" | "offline";
  joinedAt: string;
}
