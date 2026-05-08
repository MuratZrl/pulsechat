"use client";

import { useEffect, useRef, useCallback } from "react";
import { Message } from "../types";
import { MessageBubble } from "./message-bubble";
import { DateSeparator } from "./date-separator";
import { ReadReceipt } from "./read-receipt-indicator";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  roomId: string;
  onEdit: (messageId: string, newText: string) => void;
  onDelete: (messageId: string) => void;
  onReply: (message: Message) => void;
  onPin: (messageId: string) => void;
  onAvatarClick: (e: React.MouseEvent, userId: string, userName: string) => void;
  scrollToMessageId?: string | null;
  searchQuery?: string;
  readReceipts?: Record<string, ReadReceipt[]>;
  replyCountMap?: Record<string, number>;
  onOpenThread?: (message: Message) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onForward?: (message: Message) => void;
  onStar?: (messageId: string) => void;
  starredIds?: string[];
  onToggleReaction?: (messageId: string, emoji: string) => void;
  pinnedIds?: string[];
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function MessageList({
  messages,
  currentUserId,
  roomId,
  onEdit,
  onDelete,
  onReply,
  onPin,
  onAvatarClick,
  scrollToMessageId,
  searchQuery,
  readReceipts,
  replyCountMap,
  onOpenThread,
  onLoadMore,
  isLoadingMore,
  hasMore,
  onForward,
  onStar,
  starredIds,
  onToggleReaction,
  pinnedIds,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLenRef = useRef(messages.length);
  const isInitialLoadRef = useRef(true);

  // Auto-scroll to bottom on new messages (but not when loading older)
  useEffect(() => {
    const wasAppend = messages.length > prevMessagesLenRef.current;
    prevMessagesLenRef.current = messages.length;

    if (isInitialLoadRef.current) {
      bottomRef.current?.scrollIntoView();
      isInitialLoadRef.current = false;
      return;
    }

    if (wasAppend) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [roomId]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onLoadMore || isLoadingMore || !hasMore) return;
    if (containerRef.current.scrollTop < 100) {
      onLoadMore();
    }
  }, [onLoadMore, isLoadingMore, hasMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!scrollToMessageId || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-msg-id="${scrollToMessageId}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-flash");
      setTimeout(() => el.classList.remove("highlight-flash"), 1500);
    }
  }, [scrollToMessageId]);

  if (messages.length === 0 && !isLoadingMore) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-secondary">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  let lastDateKey = "";

  return (
    // py-only (no horizontal padding) so each message row's hover background
    // can span edge-to-edge while keeping the content padded via px-4 on the
    // row itself.
    <div ref={containerRef} className="flex-1 overflow-y-auto py-4 scrollbar-hidden">
      <div>
        {/* Loading older messages spinner */}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading older messages...
            </div>
          </div>
        )}

        {hasMore && !isLoadingMore && (
          <div className="flex justify-center py-1">
            <button
              onClick={onLoadMore}
              className="rounded-md px-3 py-1 text-xs text-indigo-400 transition-colors hover:bg-hover hover:text-indigo-300"
            >
              Load older messages
            </button>
          </div>
        )}

        {messages.map((msg, idx) => {
          const dateKey = getDateKey(msg.createdAt);
          const showSeparator = dateKey !== lastDateKey;
          lastDateKey = dateKey;

          // Discord-style grouping: same sender, within 5 min, no date break.
          // The deleted-state check prevents a tombstone visually merging with
          // a regular message from the same author. Date-rollover always wins.
          const prev = idx > 0 ? messages[idx - 1] : null;
          const sameAuthor = prev != null && prev.senderId === msg.senderId;
          const sameDeletedState =
            prev != null && Boolean(prev.isDeleted) === Boolean(msg.isDeleted);
          const withinWindow =
            prev != null &&
            new Date(msg.createdAt).getTime() -
              new Date(prev.createdAt).getTime() <
              GROUP_WINDOW_MS;
          const isGrouped =
            !showSeparator && sameAuthor && sameDeletedState && withinWindow;

          return (
            <div key={msg.id} data-msg-id={msg.id}>
              {showSeparator && (
                <div className="px-4">
                  <DateSeparator date={msg.createdAt} />
                </div>
              )}
              <MessageBubble
                message={msg}
                isOwn={msg.senderId === currentUserId}
                isGrouped={isGrouped}
                currentUserId={currentUserId}
                roomId={roomId}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                onPin={onPin}
                onAvatarClick={onAvatarClick}
                searchQuery={searchQuery}
                readReceipts={readReceipts?.[msg.id]}
                replyCount={replyCountMap?.[msg.id]}
                onOpenThread={onOpenThread}
                onForward={onForward ? () => onForward(msg) : undefined}
                onStar={onStar ? () => onStar(msg.id) : undefined}
                isStarred={starredIds?.includes(msg.id)}
                isPinnedMsg={pinnedIds?.includes(msg.id)}
                onToggleReaction={onToggleReaction}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
