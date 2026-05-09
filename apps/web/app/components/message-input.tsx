"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Message, Attachment } from "../types";
import { EmojiPicker } from "./emoji-picker";
import { AttachmentPicker } from "./attachment-picker";
import { GifPicker } from "./gif-picker";
import { VoiceRecorder } from "./voice-recorder";
import { ReplyPreviewBar } from "./reply-preview";
import { GiphyGif } from "../lib/giphy";
import { apiClient } from "../lib/api-client";
import { useSocket } from "../hooks/useSocket";

interface RoomUser {
  id: string;
  name: string;
}

interface MessageInputProps {
  onSend: (text: string, options?: { replyToId?: string; attachment?: Attachment }) => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  roomId?: string;
}

/** Returns the partial word after @ at the cursor, or null */
function getMentionPrefix(value: string, cursorPos: number): string | null {
  const before = value.slice(0, cursorPos);
  const match = before.match(/@(\w*)$/);
  return match ? match[1] : null;
}

export function MessageInput({ onSend, replyingTo, onCancelReply, roomId }: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // @mention autocomplete
  const [allUsers, setAllUsers] = useState<RoomUser[]>([]);
  const [mentionPrefix, setMentionPrefix] = useState<string | null>(null);
  const [mentionHighlight, setMentionHighlight] = useState(0);

  // Load users once for @mention
  useEffect(() => {
    apiClient.get<RoomUser[]>("/rooms/users/list").then(setAllUsers).catch(() => {});
  }, []);

  // Typing indicator wiring. Throttle typing_start to one emit per ~2.5s
  // (each emit refreshes the receiver-side 3s safety window in page.tsx),
  // and schedule a typing_stop 3s after the last keystroke. The throttle
  // and stop window are matched so client and server agree on when typing
  // ends, and so a missed stop is recovered by the receiver's safety net
  // at roughly the same moment the sender would have given up anyway.
  const { socket } = useSocket();
  const lastTypingEmitAtRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef<boolean>(false);

  function emitTypingStop() {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (isTypingRef.current && socket && roomId) {
      socket.emit("typing_stop", { roomId });
    }
    isTypingRef.current = false;
    lastTypingEmitAtRef.current = 0;
  }

  // Cleanup on unmount and room-change. The cleanup closure captures the
  // socket+roomId from the render where the effect ran, so when roomId
  // flips A → B the OLD room receives the stop signal before the new
  // effect sets up.
  useEffect(() => {
    return () => emitTypingStop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socket]);

  const filteredUsers =
    mentionPrefix !== null
      ? allUsers
          .filter((u) => u.name.toLowerCase().startsWith(mentionPrefix.toLowerCase()))
          .slice(0, 6)
      : [];

  function closeAllPickers() {
    setShowEmoji(false);
    setShowAttachment(false);
    setShowGifPicker(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && !pendingAttachment) return;

    // Auto-label fallback when the user typed nothing. Images and voice
    // messages render as their own visual element (an <img> or VoicePlayer),
    // so a "Sent foo.png" caption above them is noise — Discord-style is to
    // show just the media. Generic files still get the caption because a
    // bare file card alone is easy to miss in a busy channel.
    let body = trimmed;
    if (!body && pendingAttachment) {
      const skipLabel =
        pendingAttachment.type === "image" || pendingAttachment.type === "voice";
      body = skipLabel ? "" : `Sent ${pendingAttachment.name}`;
    }

    onSend(body, {
      replyToId: replyingTo?.id,
      attachment: pendingAttachment || undefined,
    });
    // Sending implies the user is no longer typing — stop immediately
    // rather than waiting for the 3s silence timer to expire.
    emitTypingStop();
    setText("");
    setPendingAttachment(null);
    setMentionPrefix(null);
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const prefix = getMentionPrefix(val, cursor);
    setMentionPrefix(prefix);
    setMentionHighlight(0);

    // User cleared the input — they're no longer typing, signal stop now
    // rather than letting the 3s silence timer trail. (handleSubmit's own
    // setText("") doesn't reach this branch since programmatic state
    // updates don't fire onChange.)
    if (val.length === 0) {
      emitTypingStop();
      return;
    }
    if (!socket || !roomId) return;

    const now = Date.now();
    if (now - lastTypingEmitAtRef.current > 2500) {
      socket.emit("typing_start", { roomId });
      lastTypingEmitAtRef.current = now;
      isTypingRef.current = true;
    }

    // Reset the stop timer on every keystroke. As long as the user keeps
    // typing within 3s windows, this never fires; the moment they pause
    // for 3s we emit stop and the indicator clears on the receiver.
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      if (isTypingRef.current && socket && roomId) {
        socket.emit("typing_stop", { roomId });
      }
      isTypingRef.current = false;
      lastTypingEmitAtRef.current = 0;
      stopTimerRef.current = null;
    }, 3000);
  }

  /** Replace the partial @word with the selected user's @name */
  function insertMention(user: RoomUser) {
    const cursor = inputRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const replaced = before.replace(/@(\w*)$/, `@${user.name} `);
    const newText = replaced + after;
    setText(newText);
    setMentionPrefix(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = replaced.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mentionPrefix !== null && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlight((h) => (h + 1) % filteredUsers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlight((h) => (h - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[mentionHighlight] ?? filteredUsers[0]);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertMention(filteredUsers[mentionHighlight] ?? filteredUsers[0]);
        return;
      }
      if (e.key === "Escape") {
        setMentionPrefix(null);
        return;
      }
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

  function handleGifSelect(gif: GiphyGif) {
    onSend("", {
      replyToId: replyingTo?.id,
      attachment: {
        type: "image",
        name: gif.title,
        url: gif.url,
        size: "GIF",
      },
    });
    setShowGifPicker(false);
  }

  function handleVoiceSend(attachment: Attachment) {
    // Voice messages render via VoicePlayer (waveform + duration). The body
    // is empty so there's no "Voice message" caption duplicating what the
    // player already conveys visually.
    onSend("", {
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

      {/* @mention dropdown */}
      {mentionPrefix !== null && filteredUsers.length > 0 && (
        <div className="border-t border-border bg-sidebar">
          <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            Mention a user
          </p>
          <ul className="pb-1">
            {filteredUsers.map((u, i) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur
                    insertMention(u);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                    i === mentionHighlight
                      ? "bg-active text-text-primary"
                      : "text-text-secondary hover:bg-hover hover:text-text-primary"
                  }`}
                >
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-400">
                    {u.name[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span>{u.name}</span>
                </button>
              </li>
            ))}
          </ul>
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
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
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
