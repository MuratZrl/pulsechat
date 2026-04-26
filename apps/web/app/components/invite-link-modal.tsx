"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "./modal";
import { apiClient } from "../lib/api-client";
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
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const inviteUrl =
    code && typeof window !== "undefined"
      ? `${window.location.origin}/chat/join/${code}`
      : null;

  // Load existing invite on open
  useEffect(() => {
    apiClient
      .get<{ code: string | null }>(`/rooms/${roomId}/invite`)
      .then(({ code: existing }) => setCode(existing))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roomId]);

  const handleGenerate = useCallback(async () => {
    setWorking(true);
    try {
      const { code: newCode } = await apiClient.post<{ code: string }>(
        `/rooms/${roomId}/invite`
      );
      setCode(newCode);
      showToast("Invite link generated", "success");
    } catch {
      showToast("Failed to generate invite link", "error");
    } finally {
      setWorking(false);
    }
  }, [roomId, showToast]);

  const handleCopy = useCallback(() => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        showToast("Invite link copied!", "success");
      });
    }
  }, [inviteUrl, showToast]);

  const handleRevoke = useCallback(async () => {
    setWorking(true);
    try {
      await apiClient.delete(`/rooms/${roomId}/invite`);
      setCode(null);
      showToast("Invite link revoked", "info");
    } catch {
      showToast("Failed to revoke invite link", "error");
    } finally {
      setWorking(false);
    }
  }, [roomId, showToast]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      className="mx-4 w-full max-w-sm rounded-lg border border-border bg-sidebar shadow-xl"
    >
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
          {loading ? (
            <div className="flex justify-center py-4">
              <svg className="h-5 w-5 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : code ? (
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
                  disabled={working}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-hover hover:text-text-primary disabled:opacity-50"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={working}
                  className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
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
                disabled={working}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {working ? "Generating..." : "Generate Invite Link"}
              </button>
            </div>
          )}
        </div>
    </Modal>
  );
}
