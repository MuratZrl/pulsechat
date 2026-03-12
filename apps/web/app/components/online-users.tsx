"use client";

import { OnlineUser, UserStatus } from "../lib/mock-users";
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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <div className="space-y-1">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover"
          >
            <button
              onClick={(e) => onAvatarClick?.(e, user.id, user.name)}
              className="relative cursor-pointer"
            >
              <Avatar name={user.name} size="sm" />
              <div
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar ${statusColors[user.status]}`}
                title={statusLabels[user.status]}
              />
            </button>
            <span className="text-sm text-text-primary">{user.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
