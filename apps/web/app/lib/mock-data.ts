import { Room, Message, Attachment } from "../types";

const ROOMS_KEY = "chat_rooms";
const MESSAGES_KEY = "chat_messages";

const defaultRooms: Room[] = [
  {
    id: "room-1",
    name: "General",
    createdBy: "system",
    createdAt: new Date().toISOString(),
  },
  {
    id: "room-2",
    name: "Random",
    createdBy: "system",
    createdAt: new Date().toISOString(),
  },
];

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}

function daysAgo(d: number, hour = 12): string {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const defaultMessages: Message[] = [
  {
    id: "msg-1",
    roomId: "room-1",
    senderId: "user-mock-1",
    senderName: "Alice",
    text: "Hey everyone! I just set up this chat app.",
    createdAt: daysAgo(1, 10),
  },
  {
    id: "msg-2",
    roomId: "room-1",
    senderId: "user-mock-2",
    senderName: "Bob",
    text: "Looks awesome! Very clean UI.",
    createdAt: daysAgo(1, 10),
  },
  {
    id: "msg-3",
    roomId: "room-1",
    senderId: "user-mock-3",
    senderName: "Charlie",
    text: "Love the dark theme, feels like Discord!",
    createdAt: daysAgo(1, 14),
  },
  {
    id: "msg-4",
    roomId: "room-1",
    senderId: "user-mock-1",
    senderName: "Alice",
    text: "Good morning! Ready for another productive day?",
    createdAt: hoursAgo(3),
  },
  {
    id: "msg-5",
    roomId: "room-1",
    senderId: "user-mock-2",
    senderName: "Bob",
    text: "Absolutely! Let's ship some features today.",
    createdAt: hoursAgo(2),
  },
  {
    id: "msg-6",
    roomId: "room-2",
    senderId: "user-mock-1",
    senderName: "Alice",
    text: "This is the random channel, anything goes!",
    createdAt: hoursAgo(5),
  },
  {
    id: "msg-7",
    roomId: "room-2",
    senderId: "user-mock-3",
    senderName: "Charlie",
    text: "Has anyone tried the new emoji picker? We should add one here.",
    createdAt: hoursAgo(1),
  },
];

function loadRooms(): Room[] {
  if (typeof window === "undefined") return defaultRooms;
  const stored = localStorage.getItem(ROOMS_KEY);
  return stored ? JSON.parse(stored) : defaultRooms;
}

function saveRooms(rooms: Room[]) {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

function loadMessages(): Message[] {
  if (typeof window === "undefined") return defaultMessages;
  const stored = localStorage.getItem(MESSAGES_KEY);
  return stored ? JSON.parse(stored) : defaultMessages;
}

function saveMessages(messages: Message[]) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

export function getRooms(): Room[] {
  return loadRooms();
}

export function createRoom(name: string, userId: string): Room {
  const rooms = loadRooms();
  const room: Room = {
    id: `room-${Date.now()}`,
    name,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };
  rooms.push(room);
  saveRooms(rooms);
  return room;
}

export function getMessages(roomId: string): Message[] {
  return loadMessages().filter((m) => m.roomId === roomId);
}

export function sendMessage(
  roomId: string,
  senderId: string,
  senderName: string,
  text: string,
  options?: { replyToId?: string; attachment?: Attachment }
): Message {
  const messages = loadMessages();
  const message: Message = {
    id: `msg-${Date.now()}`,
    roomId,
    senderId,
    senderName,
    text,
    createdAt: new Date().toISOString(),
    ...(options?.replyToId && { replyToId: options.replyToId }),
    ...(options?.attachment && { attachment: options.attachment }),
  };
  messages.push(message);
  saveMessages(messages);
  return message;
}

export function getMessageById(messageId: string): Message | undefined {
  return loadMessages().find((m) => m.id === messageId);
}

export function editMessage(messageId: string, newText: string): Message | null {
  const messages = loadMessages();
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return null;
  msg.text = newText;
  msg.editedAt = new Date().toISOString();
  saveMessages(messages);
  return { ...msg };
}

export function deleteMessage(messageId: string): Message | null {
  const messages = loadMessages();
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return null;
  msg.isDeleted = true;
  msg.text = "";
  saveMessages(messages);
  return { ...msg };
}

// --- Pagination support ---

const OLDER_MESSAGES_KEY = "chat_older_generated";

const olderPhrases = [
  "Sounds good to me!", "I'll look into it.", "That's interesting, tell me more.",
  "Working on it now.", "Can someone review my PR?", "Just pushed an update.",
  "Let's discuss this in the meeting.", "Anyone available for a quick call?",
  "Great progress today!", "I found a bug in the latest build.",
  "The deployment went smoothly.", "Documentation has been updated.",
  "Let me check the logs.", "This needs more testing.",
  "Happy Friday everyone!", "Does anyone have the API docs?",
  "I'll handle that ticket.", "Feature is ready for QA.",
  "Nice work on the redesign!", "Let's sync up tomorrow morning.",
];

const mockUsers = [
  { id: "user-mock-1", name: "Alice" },
  { id: "user-mock-2", name: "Bob" },
  { id: "user-mock-3", name: "Charlie" },
  { id: "user-mock-4", name: "Diana" },
  { id: "user-mock-5", name: "Eve" },
];

export function generateOlderMessages(roomId: string, count: number, beforeTimestamp: string): Message[] {
  const generated: Message[] = [];
  const baseTime = new Date(beforeTimestamp).getTime();

  for (let i = 0; i < count; i++) {
    const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    const minutesBack = (i + 1) * (5 + Math.floor(Math.random() * 30));
    const timestamp = new Date(baseTime - minutesBack * 60000).toISOString();

    generated.push({
      id: `msg-old-${roomId}-${baseTime}-${i}`,
      roomId,
      senderId: user.id,
      senderName: user.name,
      text: olderPhrases[Math.floor(Math.random() * olderPhrases.length)],
      createdAt: timestamp,
    });
  }

  // Sort oldest first
  generated.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Persist so they remain consistent
  const all = loadMessages();
  all.unshift(...generated);
  saveMessages(all);

  return generated;
}

export function getMessagesPaginated(
  roomId: string,
  limit = 30,
  beforeTimestamp?: string
): { messages: Message[]; hasMore: boolean } {
  const allForRoom = loadMessages()
    .filter((m) => m.roomId === roomId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (!beforeTimestamp) {
    // Return latest messages
    const start = Math.max(0, allForRoom.length - limit);
    return {
      messages: allForRoom.slice(start),
      hasMore: start > 0,
    };
  }

  const beforeIndex = allForRoom.findIndex((m) => m.createdAt >= beforeTimestamp);
  const endIndex = beforeIndex <= 0 ? 0 : beforeIndex;
  const startIndex = Math.max(0, endIndex - limit);

  return {
    messages: allForRoom.slice(startIndex, endIndex),
    hasMore: startIndex > 0,
  };
}

export function forwardMessage(
  originalMsg: Message,
  targetRoomId: string,
  senderId: string,
  senderName: string,
  originalRoomName: string
): Message {
  const messages = loadMessages();
  const message: Message = {
    id: `msg-${Date.now()}`,
    roomId: targetRoomId,
    senderId,
    senderName,
    text: originalMsg.text,
    createdAt: new Date().toISOString(),
    forwarded: {
      originalSender: originalMsg.senderName,
      originalRoom: originalRoomName,
    },
  };
  messages.push(message);
  saveMessages(messages);
  return message;
}
