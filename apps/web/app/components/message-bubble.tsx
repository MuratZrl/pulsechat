"use client";

import { useState, useCallback } from "react";
import { Message, Reactions } from "../types";
import { Avatar } from "./avatar";
import { ReactionBar } from "./reaction-bar";
import { MessageActions } from "./message-actions";
import { ReplyQuote } from "./reply-preview";
import { AttachmentCard } from "./attachment-card";
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
  isGrouped?: boolean;
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
  isPinnedMsg?: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  isGrouped = false,
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
  isPinnedMsg,
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

  const pinned = isPinnedMsg ?? false;

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

  // Discord-style row: edge-to-edge hover, fixed avatar gutter, content fills
  // the rest of the chat width. `py-px` keeps grouped messages tight (~2px),
  // `mt-4` on the first row of a new group restores ~17px between groups.
  const rowClass = `group relative flex gap-3 px-4 py-px hover:bg-hover/30 ${
    isGrouped ? "" : "mt-4"
  }`;

  const Gutter = () =>
    isGrouped ? (
      // Empty block + absolute span: keeps the gutter's natural height at 0
      // so the flex row collapses to the content row's height (~20px) instead
      // of being dragged to 51px by the strut of a wrapping "02:35 AM" line.
      // `leading-none` on the div prevents a phantom line-box from forming
      // even briefly during render.
      <div className="relative w-10 flex-shrink-0 leading-none">
        <span
          className="absolute right-1 top-[3px] whitespace-nowrap text-[10px] text-text-secondary opacity-0 transition-opacity group-hover:opacity-100"
          title={fullTimestamp}
        >
          {time}
        </span>
      </div>
    ) : (
      <button
        onClick={(e) => onAvatarClick(e, message.senderId, message.senderName)}
        className="flex w-10 flex-shrink-0 cursor-pointer pt-0.5"
        aria-label={`Open ${message.senderName}'s profile`}
      >
        <Avatar
          name={message.senderName}
          size="md"
          avatarUrl={message.senderAvatarUrl}
          avatarPreset={message.senderAvatarPreset}
        />
      </button>
    );

  // Deleted message — same Discord row, italic placeholder in place of text.
  if (message.isDeleted) {
    return (
      <div className={rowClass}>
        <Gutter />
        <div className="min-w-0 flex-1">
          {!isGrouped && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-text-primary">
                {message.senderName}
              </span>
              <RoleBadge role={getUserRole(roomId, message.senderId)} />
              <span
                className="text-[10px] text-text-secondary"
                title={fullTimestamp}
              >
                {time}
              </span>
            </div>
          )}
          <p className="text-sm italic text-text-secondary">
            This message was deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={rowClass}>
      <Gutter />

      <div className="min-w-0 flex-1">
        {/* Inner content wrapper. `relative` so MessageActions's absolute
            positioning resolves against this constrained block, and
            `max-w-2xl` caps the visual content at ~672px so on wide
            screens the toolbar sits adjacent to the message body instead
            of floating at the row's right edge.

            We deliberately don't use `w-fit` here even though it would
            put the toolbar tighter against short content: lazy-loaded
            GIFs render at 0×0 until they enter the viewport, which
            collapses a `w-fit` wrapper to zero width and parks the
            absolute toolbar at content-start until the image lays out.
            Fixed-cap is visually consistent across all content kinds
            at the cost of some empty space on short messages.

            The outer `min-w-0 flex-1` keeps the flex layout against
            the gutter unchanged; this inner block handles content
            sizing. */}
        <div className="relative max-w-2xl">
        {/* Floating action menu — anchored to this wrapper's top-right. */}
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
          onToggleReaction={
            onToggleReaction
              ? (emoji: string) => onToggleReaction(message.id, emoji)
              : undefined
          }
          isStarred={isStarred}
        />

        {!isGrouped && (
          <div className="flex flex-wrap items-baseline gap-2 leading-tight">
            <button
              onClick={(e) => onAvatarClick(e, message.senderId, message.senderName)}
              className="text-sm font-medium text-text-primary hover:underline"
            >
              {message.senderName}
            </button>
            <RoleBadge role={getUserRole(roomId, message.senderId)} />
            <span
              className="text-[10px] text-text-secondary"
              title={fullTimestamp}
            >
              {time}
            </span>
            {message.editedAt && (
              <span className="text-[10px] text-text-secondary">(edited)</span>
            )}
            {isStarred && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
                className="text-yellow-400"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {pinned && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-secondary"
              >
                <path d="M12 17v5" />
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.76z" />
              </svg>
            )}
          </div>
        )}

        {/* Forwarded label */}
        {message.forwarded && (
          <p className="flex items-center gap-1 text-[10px] italic text-text-secondary">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 17 5-5-5-5" />
              <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
            </svg>
            Forwarded from #{message.forwarded.originalRoom}
          </p>
        )}

        {/* Reply quote */}
        {message.replyToId && (
          <ReplyQuote
            replyTo={message.replyTo ?? null}
            currentUserId={currentUserId}
          />
        )}

        {/* Message text or edit mode. The text container is a plain block so
            it inherits the full content-column width — no flex wrapper that
            could cap the FormattedText span's wrap point. */}
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
                className="rounded bg-indigo-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-400"
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
          // Suppress the body when the message is a GIF. New GIF sends use
          // an empty body, but legacy data carries a "[GIF] {title}" caption
          // written by the pre-GIPHY sender path; both should collapse to
          // "no caption" so only the image renders. The title still surfaces
          // via the <img alt> on the GIF below.
          message.text && message.attachment?.size !== "GIF" && (
            <div className="text-sm leading-snug text-text-primary break-words">
              {/* `[&>p]:m-0` strips marked's default 1em paragraph margins
                  (~14px top + 14px bottom at text-sm) which were inflating
                  every grouped row. `[&>p+p]:mt-1.5` keeps a 6px gap
                  between paragraphs in multi-paragraph messages. */}
              <FormattedText
                text={message.text}
                className="text-sm break-words text-text-primary [&>p]:m-0 [&>p+p]:mt-1.5"
                highlightQuery={searchQuery}
                mentions={message.mentions}
                currentUserId={currentUserId}
              />
              {isGrouped && message.editedAt && (
                <span className="ml-1 text-[10px] text-text-secondary">
                  (edited)
                </span>
              )}
            </div>
          )
        )}

        {/* Attachment — pass isOwn=false so styling stays uniform */}
        {message.attachment && message.attachment.type === "voice" ? (
          <VoicePlayer attachment={message.attachment} isOwn={false} />
        ) : message.attachment && message.attachment.size === "GIF" ? (
          message.attachment.url?.startsWith("http") ? (
            // Real GIF (GIPHY) — render as an image. `block` is load-bearing:
            // an inline img with loading="lazy" reports h=0 until it enters
            // the viewport, but its parent's line-box still reserves
            // ~24px of strut height (inherited line-height) plus the 4px
            // mt-1, padding the row with ~28px of phantom space until the
            // image lays out. As a block element it skips the line-box
            // entirely and contributes only its own height + mt-1.
            <img
              src={message.attachment.url}
              alt={message.attachment.name || "GIF"}
              loading="lazy"
              className="mt-1 block max-h-64 max-w-xs rounded-md object-contain"
            />
          ) : (
            // Legacy fallback for messages stored before the GIPHY swap, when
            // attachment.url held a hex color rather than a real URL.
            <div
              className="mt-1 flex h-24 w-40 items-center justify-center rounded-md text-3xl"
              style={{ backgroundColor: message.attachment.url || "#6366f1" }}
            >
              {message.attachment.name?.includes("Heart") ||
              message.attachment.name?.includes("Love")
                ? "❤️"
                : message.attachment.name?.includes("Party") ||
                    message.attachment.name?.includes("Confetti")
                  ? "🎉"
                  : "😂"}
            </div>
          )
        ) : message.attachment ? (
          <AttachmentCard attachment={message.attachment} isOwn={false} />
        ) : null}

        {/* Link preview */}
        {!isEditing &&
          !message.attachment &&
          (() => {
            const urls = extractUrls(message.text);
            if (urls.length === 0) return null;
            const preview = getLinkPreview(urls[0]);
            return <LinkPreviewCard preview={preview} isOwn={false} />;
          })()}

        {/* Reactions */}
        <ReactionBar
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={handleToggleReaction}
        />

        {/* Read receipts (own messages only) */}
        {isOwn && readReceipts && readReceipts.length > 0 && (
          <div className="mt-0.5 flex justify-end">
            <ReadReceiptIndicator receipts={readReceipts} />
          </div>
        )}

        {/* Thread reply count */}
        {replyCount != null && replyCount > 0 && (
          <button
            onClick={() => onOpenThread?.(message)}
            className="mt-0.5 flex items-center gap-1 text-xs text-indigo-400 hover:underline"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
