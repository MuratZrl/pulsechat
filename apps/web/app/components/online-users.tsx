"use client";

import { OnlineUser, UserStatus } from "../types";
import { Avatar } from "./avatar";

const statusColors: Record<UserStatus, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  offline: "bg-zinc-500",
};

const statusLabels: Record<UserStatus, string> = {
  online: "Online",
  idle: "Idle",
  offline: "Offline",
};

interface OnlineUsersProps {
  users: OnlineUser[];
  onAvatarClick?: (e: React.MouseEvent, userId: string, userName: string) => void;
}

export function OnlineUsers({ users, onAvatarClick }: OnlineUsersProps) {
  const online = users.filter((u) => u.status === "online");
  const idle = users.filter((u) => u.status === "idle");
  const offline = users.filter((u) => u.status === "offline");

  return (
    <div className="flex w-56 flex-col border-l border-border bg-sidebar p-4">
      {online.length > 0 && (
        <UserGroup label={`Online — ${online.length}`} users={online} onAvatarClick={onAvatarClick} />
      )}
      {idle.length > 0 && (
        <UserGroup label={`Idle — ${idle.length}`} users={idle} onAvatarClick={onAvatarClick} />
      )}
      {offline.length > 0 && (
        <UserGroup label={`Offline — ${offline.length}`} users={offline} onAvatarClick={onAvatarClick} />
      )}
    </div>
  );
}

function UserGroup({
  label,
  users,
  onAvatarClick,
}: {
  label: string;
  users: OnlineUser[];
  onAvatarClick?: (e: React.MouseEvent, userId: string, userName: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </p>
      <div className="space-y-0.5">
        {users.map((user) => {
          // Whole row is the click target (Discord parity) — clicking the
          // name opens the same profile popover as clicking the avatar.
          // Offline users get an opacity drop on the row container so both
          // avatar and name visually recede together.
          const isOffline = user.status === "offline";
          return (
            <button
              key={user.id}
              onClick={(e) => onAvatarClick?.(e, user.id, user.name)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left transition-opacity hover:bg-hover ${
                isOffline ? "opacity-50" : ""
              }`}
            >
              <span className="relative">
                <Avatar name={user.name} size="sm" />
                {/* Status dot anchored at the avatar's bottom-right with a
                    small outward translate, plus a 2px border in the panel
                    bg color to read as a separate puck rather than a tinted
                    avatar corner. */}
                <span
                  className={`absolute bottom-0 right-0 h-3 w-3 translate-x-1 translate-y-1 rounded-full border-2 border-sidebar ${statusColors[user.status]}`}
                  title={statusLabels[user.status]}
                />
              </span>
              <span className="truncate text-sm text-text-primary">
                {user.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
