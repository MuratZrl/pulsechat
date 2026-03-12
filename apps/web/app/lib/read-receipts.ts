const STORAGE_KEY = "chat_read_receipts";

export interface ReadReceipt {
  userId: string;
  userName: string;
  readAt: string;
}

function getAll(): Record<string, ReadReceipt[]> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveAll(data: Record<string, ReadReceipt[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getReadReceipts(messageId: string): ReadReceipt[] {
  return getAll()[messageId] || [];
}

export function markAsRead(
  messageId: string,
  userId: string,
  userName: string
): ReadReceipt[] {
  const all = getAll();
  const receipts = all[messageId] || [];
  if (receipts.some((r) => r.userId === userId)) return receipts;
  receipts.push({ userId, userName, readAt: new Date().toISOString() });
  all[messageId] = receipts;
  saveAll(all);
  return receipts;
}

export function getReadReceiptsForMessages(
  messageIds: string[]
): Record<string, ReadReceipt[]> {
  const all = getAll();
  const result: Record<string, ReadReceipt[]> = {};
  for (const id of messageIds) {
    if (all[id]) result[id] = all[id];
  }
  return result;
}
