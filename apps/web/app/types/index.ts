export interface User {
  id: string;
  name: string;
  email: string;
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
}

export type Reactions = Record<string, string[]>; // emoji -> userIds[]

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  isDeleted?: boolean;
  replyToId?: string;
  replyTo?: ReplyPreview;
  attachment?: Attachment;
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
  avatarUrl?: string;
  status: "online" | "idle" | "offline";
  joinedAt: string;
}
