export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface Attachment {
  name: string;
  type: "image" | "file" | "voice";
  size: string;
  url?: string;
  duration?: number;
}

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
  attachment?: Attachment;
  forwarded?: {
    originalSender: string;
    originalRoom: string;
  };
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
