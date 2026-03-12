import { RoomRole } from "../lib/room-roles";

interface RoleBadgeProps {
  role: RoomRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  if (role === "member") return null;

  const config = {
    admin: { label: "Admin", className: "bg-red-500/20 text-red-400" },
    moderator: { label: "Mod", className: "bg-yellow-500/20 text-yellow-400" },
  };

  const { label, className } = config[role];

  return (
    <span
      className={`ml-1 inline-flex items-center rounded px-1 py-0.5 text-[8px] font-bold uppercase leading-none ${className}`}
    >
      {label}
    </span>
  );
}
