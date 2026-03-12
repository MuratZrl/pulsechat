"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Message } from "../types";
import { Avatar } from "./avatar";
import { FormattedText } from "./formatted-text";

interface ThreadPanelProps {
  parentMessage: Message;
  allMessages: Message[];
  currentUserId: string;
  onSendReply: (text: string, replyToId: string) => void;
  onClose: () => void;
}

export function ThreadPanel({
  parentMessage,
  allMessages,
  currentUserId,
  onSendReply,
  onClose,
}: ThreadPanelProps) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const replies = allMessages.filter(
    (m) => m.replyToId === parentMessage.id && !m.isDeleted
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies.length]);

  const parentTime = new Date(parentMessage.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendReply(trimmed, parentMessage.id);
    setText("");
  }

  return (
    <div className="flex w-72 flex-col border-l border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-xs font-semibold text-text-primary">Thread</p>
        <button
          onClick={onClose}
          className="rounded p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Parent message */}
      <div className="border-b border-border p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Avatar name={parentMessage.senderName} size="sm" />
          <span className="text-xs font-medium text-text-primary">
            {parentMessage.senderName}
          </span>
          <span className="text-[10px] text-text-secondary">{parentTime}</span>
        </div>
        <FormattedText
          text={parentMessage.text}
          className="text-xs text-text-primary break-words"
        />
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden p-3">
        {replies.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-secondary">
            No replies yet
          </p>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => {
              const isOwn = reply.senderId === currentUserId;
              const replyTime = new Date(reply.createdAt).toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" }
              );
              return (
                <div key={reply.id} className="flex items-start gap-2">
                  <Avatar name={reply.senderName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium text-text-primary">
                        {reply.senderName}
                      </span>
                      <span className="text-[10px] text-text-secondary">
                        {replyTime}
                      </span>
                    </div>
                    <FormattedText
                      text={reply.text}
                      className="text-xs text-text-primary break-words"
                    />
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Reply input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border p-2"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply..."
          className="flex-1 rounded border border-border bg-input px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Send
        </button>
      </form>
    </div>
  );
}
