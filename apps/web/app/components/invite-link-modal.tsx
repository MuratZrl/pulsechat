"use client";

import { useState, useCallback } from "react";
import {
  generateInviteCode,
  getInviteCode,
  revokeInviteCode,
} from "../lib/room-invites";
import { useToast } from "./toast";

interface InviteLinkModalProps {
  roomId: string;
  roomName: string;
  onClose: () => void;
}

export function InviteLinkModal({
  roomId,
  roomName,
  onClose,
}: InviteLinkModalProps) {
  const { showToast } = useToast();
  const [code, setCode] = useState<string | null>(
    () => getInviteCode(roomId)
  );

  const inviteUrl = code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/chat/join/${code}`
    : null;

  const handleGenerate = useCallback(() => {
    const newCode = generateInviteCode(roomId);
    setCode(newCode);
    showToast("Invite link generated", "success");
  }, [roomId, showToast]);

  const handleCopy = useCallback(() => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        showToast("Invite link copied!", "success");
      });
    }
  }, [inviteUrl, showToast]);

  const handleRevoke = useCallback(() => {
    revokeInviteCode(roomId);
    setCode(null);
    showToast("Invite link revoked", "info");
  }, [roomId, showToast]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-sidebar shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Invite to #{roomName}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {code ? (
            <>
              <p className="mb-2 text-xs text-text-secondary">
                Share this invite link with others:
              </p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-input p-2">
                <code className="flex-1 truncate text-xs text-text-primary">
                  {inviteUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Copy
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-hover hover:text-text-primary"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleRevoke}
                  className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                >
                  Revoke
                </button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="mb-3 text-xs text-text-secondary">
                No active invite link. Generate one to share with others.
              </p>
              <button
                onClick={handleGenerate}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Generate Invite Link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
