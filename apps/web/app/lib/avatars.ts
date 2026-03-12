// Preset avatar generator (SVG data URIs — no backend needed)

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
