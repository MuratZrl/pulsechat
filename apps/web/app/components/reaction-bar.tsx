"use client";

import { useState } from "react";
import { Reactions } from "../lib/reactions";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "👀"];

interface ReactionBarProps {
  reactions: Reactions;
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

export function ReactionBar({ reactions, currentUserId, onToggle }: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const entries = Object.entries(reactions);

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {entries.map(([emoji, userIds]) => {
        const hasReacted = userIds.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
              hasReacted
                ? "border-indigo-500/50 bg-indigo-500/10 text-text-primary"
                : "border-border bg-hover text-text-secondary hover:border-border hover:text-text-primary"
            }`}
          >
            <span>{emoji}</span>
            <span>{userIds.length}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker((p) => !p)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-hover hover:text-text-primary"
          title="Add reaction"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-1 rounded-lg border border-border bg-sidebar p-1.5 shadow-lg">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onToggle(emoji);
                  setShowPicker(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-hover text-sm"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
