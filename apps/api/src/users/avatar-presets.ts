// Whitelist of valid built-in avatar presets. Lives on the API side as the
// authoritative source — the DTO uses it for validation and the service uses
// it for sanity-checks. Frontend keeps its own list in lib/avatars.ts; the
// two must stay in sync (any preset accepted here must be renderable there).
export const AVATAR_PRESETS = [
  'cat',
  'dog',
  'fox',
  'panda',
  'unicorn',
  'robot',
  'alien',
  'ghost',
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];
