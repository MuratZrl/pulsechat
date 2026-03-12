const STORAGE_KEY = "chat_reactions";

export type Reactions = Record<string, string[]>; // emoji → userIds

function getAll(): Record<string, Reactions> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveAll(data: Record<string, Reactions>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getReactions(messageId: string): Reactions {
  return getAll()[messageId] || {};
}

export function toggleReaction(
  messageId: string,
  emoji: string,
  userId: string
): Reactions {
  const all = getAll();
  const msgReactions = all[messageId] || {};
  const users = msgReactions[emoji] || [];

  if (users.includes(userId)) {
    const updated = users.filter((id) => id !== userId);
    if (updated.length === 0) {
      delete msgReactions[emoji];
    } else {
      msgReactions[emoji] = updated;
    }
  } else {
    msgReactions[emoji] = [...users, userId];
  }

  if (Object.keys(msgReactions).length === 0) {
    delete all[messageId];
  } else {
    all[messageId] = msgReactions;
  }

  saveAll(all);
  return msgReactions;
}
