const COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-rose-500",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  avatarUrl?: string | null;
}

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
  xl: "h-16 w-16 text-lg",
};

export function Avatar({ name, size = "md", avatarUrl }: AvatarProps) {
  const sizeClass = sizeClasses[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${sizeClass}`}
      />
    );
  }

  const color = COLORS[hashName(name) % COLORS.length];
  const initials = getInitials(name);

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color} ${sizeClass}`}
    >
      {initials}
    </div>
  );
}
