const INVITES_KEY = "chat_room_invites";

interface InviteEntry {
  roomId: string;
  code: string;
  createdAt: string;
}

function loadInvites(): InviteEntry[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(INVITES_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveInvites(invites: InviteEntry[]) {
  localStorage.setItem(INVITES_KEY, JSON.stringify(invites));
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateInviteCode(roomId: string): string {
  const invites = loadInvites();
  // Remove existing for this room
  const filtered = invites.filter((i) => i.roomId !== roomId);
  const code = randomCode();
  filtered.push({ roomId, code, createdAt: new Date().toISOString() });
  saveInvites(filtered);
  return code;
}

export function getInviteCode(roomId: string): string | null {
  const invites = loadInvites();
  const entry = invites.find((i) => i.roomId === roomId);
  return entry?.code || null;
}

export function resolveInviteCode(code: string): string | null {
  const invites = loadInvites();
  const entry = invites.find((i) => i.code === code);
  return entry?.roomId || null;
}

export function revokeInviteCode(roomId: string): void {
  const invites = loadInvites();
  const filtered = invites.filter((i) => i.roomId !== roomId);
  saveInvites(filtered);
}
