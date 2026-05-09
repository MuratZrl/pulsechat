// Preset avatars are SVG data URIs generated client-side — no static asset
// roundtrip and no backend storage of the resolved image. The DB stores the
// preset id ("cat", "fox", ...) on User.avatarPreset; rendering resolves it
// here. The id list must stay in sync with `AVATAR_PRESETS` on the API side
// (apps/api/src/users/avatar-presets.ts) — anything the API accepts must be
// renderable here.

export const AVATAR_PRESET_IDS = [
  'cat',
  'dog',
  'fox',
  'panda',
  'unicorn',
  'robot',
  'alien',
  'ghost',
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];

export interface PresetAvatar {
  id: AvatarPresetId;
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

const PRESET_BY_ID = new Map<string, PresetAvatar>(
  PRESET_AVATARS.map((p) => [p.id, p])
);

/**
 * Centralized avatar resolution. Every render site should pipe both fields
 * through this helper so the precedence rule lives in exactly one place:
 *   preset wins → custom URL → null (caller renders initials/fallback).
 *
 * Both fields are accepted as `null | undefined` so callers can pass the raw
 * server payload without coercing.
 */
export function resolveAvatarUrl(input: {
  avatarUrl?: string | null;
  avatarPreset?: string | null;
}): string | null {
  if (input.avatarPreset) {
    const match = PRESET_BY_ID.get(input.avatarPreset);
    if (match) return match.url;
  }
  if (input.avatarUrl) return input.avatarUrl;
  return null;
}
