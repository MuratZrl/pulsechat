"use client";

import { useState, useRef, FormEvent } from "react";
import { Message, Attachment } from "../types";
import { EmojiPicker } from "./emoji-picker";
import { AttachmentPicker } from "./attachment-picker";
import { GifPicker } from "./gif-picker";
import { VoiceRecorder } from "./voice-recorder";
import { ReplyPreviewBar } from "./reply-preview";
import { MockGif } from "../lib/mock-gifs";

interface MessageInputProps {
  onSend: (text: string, options?: { replyToId?: string; attachment?: Attachment }) => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export function MessageInput({ onSend, replyingTo, onCancelReply }: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function closeAllPickers() {
    setShowEmoji(false);
    setShowAttachment(false);
    setShowGifPicker(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed || pendingAttachment) {
      onSend(trimmed || (pendingAttachment ? `Sent ${pendingAttachment.name}` : ""), {
        replyToId: replyingTo?.id,
        attachment: pendingAttachment || undefined,
      });
      setText("");
      setPendingAttachment(null);
    }
  }

  function handleEmojiSelect(emoji: string) {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  }

  function handleAttachmentSelect(attachment: Attachment) {
    setPendingAttachment(attachment);
    setShowAttachment(false);
    inputRef.current?.focus();
  }

  function handleGifSelect(gif: MockGif) {
    onSend(`[GIF] ${gif.title}`, {
      replyToId: replyingTo?.id,
      attachment: {
        type: "image",
        name: gif.title,
        url: gif.color,
        size: "GIF",
      },
    });
    setShowGifPicker(false);
  }

  function handleVoiceSend(attachment: Attachment) {
    onSend("Voice message", {
      replyToId: replyingTo?.id,
      attachment,
    });
    setShowVoiceRecorder(false);
  }

  // Show voice recorder mode
  if (showVoiceRecorder) {
    return (
      <VoiceRecorder
        onSend={handleVoiceSend}
        onCancel={() => setShowVoiceRecorder(false)}
      />
    );
  }

  return (
    <div>
      {/* Reply preview */}
      {replyingTo && onCancelReply && (
        <ReplyPreviewBar replyingTo={replyingTo} onCancel={onCancelReply} />
      )}

      {/* Pending attachment preview */}
      {pendingAttachment && (
        <div className="flex items-center gap-2 border-t border-border bg-sidebar px-4 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-500/20 text-indigo-400">
            {pendingAttachment.type === "image" ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            ) : pendingAttachment.type === "voice" ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            )}
          </div>
          <span className="flex-1 truncate text-xs text-text-primary">
            {pendingAttachment.name}
          </span>
          <button
            onClick={() => setPendingAttachment(null)}
            className="rounded p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border p-4"
      >
        {/* Attachment button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { closeAllPickers(); setShowAttachment((p) => !p); }}
            className={`rounded-md p-2 transition-colors ${
              showAttachment
                ? "bg-active text-text-primary"
                : "text-text-secondary hover:bg-hover hover:text-text-primary"
            }`}
            title="Attach file"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          {showAttachment && (
            <AttachmentPicker
              onSelect={handleAttachmentSelect}
              onClose={() => setShowAttachment(false)}
            />
          )}
        </div>

        {/* GIF button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { closeAllPickers(); setShowGifPicker((p) => !p); }}
            className={`rounded-md p-2 text-xs font-bold transition-colors ${
              showGifPicker
                ? "bg-active text-text-primary"
                : "text-text-secondary hover:bg-hover hover:text-text-primary"
            }`}
            title="GIF"
          >
            GIF
          </button>
          {showGifPicker && (
            <GifPicker
              onSelect={handleGifSelect}
              onClose={() => setShowGifPicker(false)}
            />
          )}
        </div>

        {/* Emoji button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { closeAllPickers(); setShowEmoji((p) => !p); }}
            className={`rounded-md p-2 transition-colors ${
              showEmoji
                ? "bg-active text-text-primary"
                : "text-text-secondary hover:bg-hover hover:text-text-primary"
            }`}
            title="Emoji"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={handleEmojiSelect}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>

        {/* Voice button */}
        <button
          type="button"
          onClick={() => setShowVoiceRecorder(true)}
          className="rounded-md p-2 text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          title="Voice message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Send
        </button>
      </form>
    </div>
  );
}
