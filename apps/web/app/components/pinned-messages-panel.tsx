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
    <div className="flex w-56 flex-col border-l border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-xs font-semibold text-text-primary">
          Pinned Messages
        </p>
        <button
          onClick={onClose}
          className="rounded p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hidden p-2">
        {pinnedMessages.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-text-secondary">
            No pinned messages
          </p>
        ) : (
          <div className="space-y-2">
            {pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-md border border-border bg-hover p-2"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <Avatar name={msg.senderName} size="sm" />
                  <span className="text-xs font-medium text-text-primary">
                    {msg.senderName}
                  </span>
                </div>
                <FormattedText text={msg.text} className="mb-2 text-xs text-text-secondary line-clamp-2 block" />
                <div className="flex gap-1">
                  <button
                    onClick={() => onJumpTo(msg.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-indigo-400 hover:bg-active"
                  >
                    Jump to
                  </button>
                  <button
                    onClick={() => onUnpin(msg.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-active hover:text-text-primary"
                  >
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
