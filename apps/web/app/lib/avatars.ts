const USERS_KEY = "chat_users";

export interface PresetAvatar {
  id: string;
  label: string;
  url: string;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function makeAvatar(emoji: string, bg: string): string {
  return svgToDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="${bg}"/><text x="64" y="82" font-size="64" text-anchor="middle">${emoji}</text></svg>`
  );
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: "cat", label: "Cat", url: makeAvatar("🐱", "#fbbf24") },
  { id: "dog", label: "Dog", url: makeAvatar("🐶", "#60a5fa") },
  { id: "fox", label: "Fox", url: makeAvatar("🦊", "#f97316") },
  { id: "panda", label: "Panda", url: makeAvatar("🐼", "#a3e635") },
  { id: "unicorn", label: "Unicorn", url: makeAvatar("🦄", "#c084fc") },
  { id: "robot", label: "Robot", url: makeAvatar("🤖", "#94a3b8") },
  { id: "alien", label: "Alien", url: makeAvatar("👽", "#34d399") },
  { id: "ghost", label: "Ghost", url: makeAvatar("👻", "#e879f9") },
];

export function getUserAvatar(userId: string): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) return null;
  const users = JSON.parse(stored);
  const user = users.find((u: { id: string }) => u.id === userId);
  return user?.avatarUrl || null;
}

export function saveUserAvatar(userId: string, avatarUrl: string | null) {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) return;
  const users = JSON.parse(stored);
  const idx = users.findIndex((u: { id: string }) => u.id === userId);
  if (idx === -1) return;
  users[idx].avatarUrl = avatarUrl;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
