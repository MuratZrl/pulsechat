"use client";

import { useRef, useEffect } from "react";
import { Avatar } from "./avatar";
import { getUserProfile } from "../lib/user-profiles";

const statusColors: Record<string, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  offline: "bg-zinc-500",
};

const statusLabels: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  offline: "Offline",
};

interface UserProfilePopoverProps {
  userId: string;
  userName: string;
  userStatus: "online" | "idle" | "offline";
  anchorRect: DOMRect;
  onClose: () => void;
}

export function UserProfilePopover({
  userId,
  userName,
  userStatus,
  anchorRect,
  onClose,
}: UserProfilePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const profile = getUserProfile(userId, userName, userStatus);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const top = Math.max(8, Math.min(anchorRect.bottom + 8, window.innerHeight - 280));
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 272));

  const joinDate = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-lg border border-border bg-sidebar p-4 shadow-lg"
      style={{ top, left }}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar name={profile.name} size="lg" avatarUrl={profile.avatarUrl} />
          <div
            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-sidebar ${statusColors[profile.status]}`}
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">{profile.name}</p>
          <p className="flex items-center gap-1 text-xs text-text-secondary">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColors[profile.status]}`} />
            {statusLabels[profile.status]}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs text-text-secondary">{profile.bio}</p>
      </div>

      {profile.email && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            Email
          </p>
          <p className="text-xs text-text-primary">{profile.email}</p>
        </div>
      )}

      <div className="mt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          Joined
        </p>
        <p className="text-xs text-text-primary">{joinDate}</p>
      </div>
    </div>
  );
}
