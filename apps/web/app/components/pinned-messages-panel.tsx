"use client";

import { Message } from "../types";
import { Avatar } from "./avatar";
import { FormattedText } from "./formatted-text";

interface PinnedMessagesPanelProps {
  messages: Message[];
  pinnedIds: string[];
  onUnpin: (messageId: string) => void;
  onJumpTo: (messageId: string) => void;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function PinnedMessagesPanel({
  messages,
  pinnedIds,
  onUnpin,
  onJumpTo,
  onClose,
}: PinnedMessagesPanelProps) {
  const pinnedMessages = pinnedIds
    .map((id) => messages.find((m) => m.id === id))
    .filter((m): m is Message => m != null && !m.isDeleted);

  return (
    <div className="flex w-72 flex-col border-l border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-indigo-400"
        >
          <path d="M12 17v5" />
          <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
        </svg>
        <h3 className="flex-1 text-sm font-semibold text-text-primary">
          Pinned Messages
        </h3>
        <span className="rounded-full bg-indigo-600/15 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
          {pinnedMessages.length}
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {pinnedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-hover">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-secondary">
                <path d="M12 17v5" />
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-text-secondary">
              No pinned messages yet
            </p>
            <p className="mt-1 text-[11px] text-text-secondary/60">
              Pin important messages to find them easily
            </p>
          </div>
        ) : (
          <div className="space-y-px p-2">
            {pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="group rounded-lg p-3 transition-colors hover:bg-hover"
              >
                {/* Author row */}
                <div className="mb-2 flex items-center gap-2">
                  <Avatar
                    name={msg.senderName}
                    size="sm"
                    avatarUrl={msg.senderAvatarUrl}
                    avatarPreset={msg.senderAvatarPreset}
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    {msg.senderName}
                  </span>
                  <span className="ml-auto text-[10px] text-text-secondary/60">
                    {timeAgo(msg.createdAt)}
                  </span>
                </div>

                {/* Message text */}
                <div className="mb-3 rounded-md border-l-2 border-indigo-500/40 bg-background/50 px-3 py-2">
                  <FormattedText
                    text={msg.text}
                    className="text-xs leading-relaxed text-text-secondary line-clamp-3 block"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onJumpTo(msg.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-400 transition-colors hover:bg-indigo-600/10"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5" />
                      <path d="m5 12 7-7 7 7" />
                    </svg>
                    Jump to
                  </button>
                  <button
                    onClick={() => onUnpin(msg.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Unpin
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
