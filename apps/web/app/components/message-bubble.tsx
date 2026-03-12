"use client";

import { useState, useCallback } from "react";
import { Message, Reactions } from "../types";
import { Avatar } from "./avatar";
import { ReactionBar } from "./reaction-bar";
import { MessageActions } from "./message-actions";
import { ReplyQuote } from "./reply-preview";
import { AttachmentCard } from "./attachment-card";
import { isPinned } from "../lib/pins";
import { FormattedText } from "./formatted-text";
import { ReadReceiptIndicator, ReadReceipt } from "./read-receipt-indicator";
import { VoicePlayer } from "./voice-player";
import { LinkPreviewCard } from "./link-preview-card";
import { extractUrls, getLinkPreview } from "../lib/link-preview";
import { RoleBadge } from "./role-badge";
import { getUserRole } from "../lib/room-roles";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  currentUserId: string;
  roomId: string;
  onEdit: (messageId: string, newText: string) => void;
  onDelete: (messageId: string) => void;
  onReply: (message: Message) => void;
  onPin: (messageId: string) => void;
  onAvatarClick: (e: React.MouseEvent, userId: string, userName: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  searchQuery?: string;
  readReceipts?: ReadReceipt[];
  replyCount?: number;
  onOpenThread?: (message: Message) => void;
  onForward?: () => void;
  onStar?: () => void;
  isStarred?: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  currentUserId,
  roomId,
  onEdit,
  onDelete,
  onReply,
  onPin,
  onAvatarClick,
  onToggleReaction,
  searchQuery,
  readReceipts,
  replyCount,
  onOpenThread,
  onForward,
  onStar,
  isStarred,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  const reactions: Reactions = message.reactions ?? {};

  const createdDate = new Date(message.createdAt);
  const time = createdDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const fullTimestamp = createdDate.toLocaleString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const pinned = isPinned(roomId, message.id);

  const handleToggleReaction = useCallback(
    (emoji: string) => {
      onToggleReaction?.(message.id, emoji);
    },
    [message.id, onToggleReaction]
  );

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.text) {
      onEdit(message.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.text);
    setIsEditing(false);
  };

  // Deleted message
  if (message.isDeleted) {
    return (
      <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        <Avatar name={message.senderName} size="sm" />
        <div className={`max-w-[70%] ${isOwn ? "text-right" : "text-left"}`}>
          <div className="inline-block rounded-lg px-3 py-2 text-left bg-hover/50">
            <p className="text-sm italic text-text-secondary">
              This message was deleted
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      <button
        onClick={(e) => onAvatarClick(e, message.senderId, message.senderName)}
        className="flex-shrink-0 cursor-pointer"
      >
        <Avatar name={message.senderName} size="sm" />
      </button>
      <div className={`max-w-[70%] ${isOwn ? "text-right" : "text-left"}`}>
        {/* Actions menu */}
        <MessageActions
          isOwn={isOwn}
          isPinned={pinned}
          onEdit={() => {
            setEditText(message.text);
            setIsEditing(true);
          }}
          onDelete={() => onDelete(message.id)}
          onReply={() => onReply(message)}
          onPin={() => onPin(message.id)}
          onForward={onForward}
          onStar={onStar}
          isStarred={isStarred}
        />

        <div
          className={`inline-block rounded-lg px-3 py-2 text-left ${
            isOwn ? "bg-indigo-600 text-white" : "bg-hover text-text-primary"
          }`}
        >
          {/* Forwarded label */}
          {message.forwarded && (
            <p className="mb-0.5 flex items-center gap-1 text-[10px] italic text-text-secondary">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 17 5-5-5-5" />
                <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
              </svg>
              Forwarded from #{message.forwarded.originalRoom}
            </p>
          )}

          {!isOwn && (
            <p className="mb-0.5 flex items-center text-xs font-medium text-indigo-400">
              {message.senderName}
              <RoleBadge role={getUserRole(roomId, message.senderId)} />
            </p>
          )}

          {/* Reply quote — uses server-provided replyTo preview */}
          {message.replyToId && <ReplyQuote replyTo={message.replyTo ?? null} />}

          {/* Message text or edit mode */}
          {isEditing ? (
            <div className="space-y-1">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                autoFocus
                className="w-full rounded border border-border bg-input px-2 py-1 text-sm text-text-primary focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSaveEdit}
                  className="rounded px-2 py-0.5 text-[10px] font-medium text-white bg-indigo-500 hover:bg-indigo-400"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="rounded px-2 py-0.5 text-[10px] text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <FormattedText text={message.text} className="text-sm break-words" highlightQuery={searchQuery} />
          )}

          {/* Attachment */}
          {message.attachment && message.attachment.type === "voice" ? (
            <VoicePlayer attachment={message.attachment} isOwn={isOwn} />
          ) : message.attachment && message.attachment.size === "GIF" ? (
            <div
              className="mt-1 flex h-24 w-40 items-center justify-center rounded-md text-3xl"
              style={{ backgroundColor: message.attachment.url || "#6366f1" }}
            >
              {message.attachment.name?.includes("Heart") || message.attachment.name?.includes("Love")
                ? "❤️"
                : message.attachment.name?.includes("Party") || message.attachment.name?.includes("Confetti")
                ? "🎉"
                : "😂"}
            </div>
          ) : message.attachment ? (
            <AttachmentCard attachment={message.attachment} isOwn={isOwn} />
          ) : null}

          {/* Link preview */}
          {!isEditing && !message.attachment && (() => {
            const urls = extractUrls(message.text);
            if (urls.length === 0) return null;
            const preview = getLinkPreview(urls[0]);
            return <LinkPreviewCard preview={preview} isOwn={isOwn} />;
          })()}

          {/* Timestamp + indicators */}
          <div
            className={`group/time relative mt-1 flex items-center justify-end gap-1 text-[10px] ${
              isOwn ? "text-indigo-200" : "text-text-secondary"
            }`}
          >
            {message.editedAt && <span>(edited)</span>}
            {isStarred && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {pinned && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5" />
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.76z" />
              </svg>
            )}
            <span className="cursor-default">{time}</span>
            {/* Full timestamp tooltip on hover */}
            <span className={`pointer-events-none absolute -top-8 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 text-[10px] font-medium text-background opacity-0 shadow-lg transition-opacity group-hover/time:opacity-100 ${isOwn ? "right-0" : "left-0"}`}>
              {fullTimestamp}
            </span>
            {isOwn && <ReadReceiptIndicator receipts={readReceipts || []} />}
          </div>
        </div>
        <ReactionBar
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={handleToggleReaction}
        />
        {replyCount != null && replyCount > 0 && (
          <button
            onClick={() => onOpenThread?.(message)}
            className={`mt-0.5 flex items-center gap-1 text-xs text-indigo-400 hover:underline ${isOwn ? "ml-auto" : ""}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>
    </div>
  );
}
