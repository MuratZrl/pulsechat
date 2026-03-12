"use client";

import { useState, useEffect } from "react";
import { apiClient } from "../lib/api-client";

interface StarredEntry {
  messageId: string;
  roomId: string;
  roomName: string;
  starredAt: string;
  message: {
    id: string;
    text: string;
    senderName: string;
  };
}

interface StarredMessagesPanelProps {
  onUnstar: (messageId: string) => void;
  onJumpTo: (messageId: string) => void;
  onClose: () => void;
}

export function StarredMessagesPanel({
  onUnstar,
  onJumpTo,
  onClose,
}: StarredMessagesPanelProps) {
  const [entries, setEntries] = useState<StarredEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<StarredEntry[]>("/stars")
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  function handleUnstar(messageId: string) {
    // Optimistically remove from list
    setEntries((prev) => prev.filter((e) => e.messageId !== messageId));
    onUnstar(messageId);
  }

  return (
    <div className="flex w-72 flex-col border-l border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Starred Messages
        </h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Starred messages list */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {loading ? (
          <div className="flex justify-center py-6">
            <svg className="h-5 w-5 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 text-text-secondary">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <p className="text-xs text-text-secondary">No starred messages yet</p>
            <p className="mt-1 text-[10px] text-text-secondary">
              Star messages to save them for later
            </p>
          </div>
        ) : (
          entries.map((item) => (
            <div
              key={item.messageId}
              className="border-b border-border px-4 py-3 hover:bg-hover/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-indigo-400">
                  #{item.roomName}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onJumpTo(item.messageId)}
                    className="rounded p-0.5 text-text-secondary hover:bg-hover hover:text-text-primary"
                    title="Jump to message"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleUnstar(item.messageId)}
                    className="rounded p-0.5 text-yellow-400 hover:bg-hover"
                    title="Unstar"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-[10px] font-medium text-text-secondary">
                {item.message.senderName}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-text-primary">
                {item.message.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
