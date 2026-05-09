"use client";

import { useRef, useEffect, useState } from "react";
import { Avatar } from "./avatar";
import { apiClient } from "../lib/api-client";

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

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  bio?: string;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
  createdAt?: string;
}

export function UserProfilePopover({
  userId,
  userName,
  userStatus,
  anchorRect,
  onClose,
}: UserProfilePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    apiClient
      .get<UserProfile>(`/users/${userId}`)
      .then(setProfile)
      .catch(() => setProfile({ id: userId, name: userName }));
  }, [userId, userName]);

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

  const displayName = profile?.name ?? userName;
  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 rounded-lg border border-border bg-sidebar p-4 shadow-lg"
      style={{ top, left }}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar
            name={displayName}
            size="lg"
            avatarUrl={profile?.avatarUrl}
            avatarPreset={profile?.avatarPreset}
          />
          <div
            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-sidebar ${statusColors[userStatus]}`}
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">{displayName}</p>
          <p className="flex items-center gap-1 text-xs text-text-secondary">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColors[userStatus]}`} />
            {statusLabels[userStatus]}
          </p>
        </div>
      </div>

      {profile ? (
        <>
          {profile.bio && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs text-text-secondary">{profile.bio}</p>
            </div>
          )}

          {profile.email && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                Email
              </p>
              <p className="text-xs text-text-primary">{profile.email}</p>
            </div>
          )}

          {joinDate && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                Joined
              </p>
              <p className="text-xs text-text-primary">{joinDate}</p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 flex justify-center border-t border-border pt-3">
          <svg className="h-4 w-4 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
    </div>
  );
}
