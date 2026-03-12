// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  bio: string;
  avatarUrl?: string;
  status: 'online' | 'idle' | 'offline';
  joinedAt: string;
}

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface Attachment {
  name: string;
  type: 'image' | 'file' | 'voice';
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

export interface OnlineUser {
  id: string;
  name: string;
  status: 'online' | 'idle' | 'offline';
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
}

export interface RoomWithMembers extends Room {
  members: Array<{
    userId: string;
    name: string;
    role: string;
    joinedAt: string;
  }>;
}

// ─── Socket.io Event Types ────────────────────────────────────────────────────

// Client → Server
export interface JoinRoomPayload {
  roomId: string;
}

export interface SendMessagePayload {
  roomId: string;
  text: string;
  replyToId?: string;
  attachment?: Attachment;
}

export interface EditMessagePayload {
  messageId: string;
  text: string;
}

export interface DeleteMessagePayload {
  messageId: string;
}

export interface TypingPayload {
  roomId: string;
}

// Server → Client
export interface MessageEditedPayload {
  messageId: string;
  text: string;
  editedAt: string;
}

export interface MessageDeletedPayload {
  messageId: string;
}

export interface UserTypingPayload {
  roomId: string;
  userId: string;
  userName: string;
}

export interface UserStopTypingPayload {
  roomId: string;
  userId: string;
}

export interface UserPresencePayload {
  userId: string;
  userName: string;
}

export interface RoomUsersPayload {
  roomId: string;
  users: OnlineUser[];
}
