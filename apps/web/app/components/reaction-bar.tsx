"use client";

import { Reactions } from "../types";

interface ReactionBarProps {
  reactions: Reactions;
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

export function ReactionBar({ reactions, currentUserId, onToggle }: ReactionBarProps) {
  const entries = Object.entries(reactions);

  // Render nothing when there are no reactions. The add-reaction picker now
  // lives in the floating MessageActions menu, so the row doesn't carry an
  // invisible 24px button + 4px margin on every message.
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {entries.map(([emoji, userIds]) => {
        const hasReacted = userIds.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            // `border-transparent` on the unreacted state keeps the pill the
            // same height (22px) as the reacted variant — without it, toggling
            // a reaction would shift the row by 2px when the border appears.
            className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 transition-colors duration-100 ${
              hasReacted
                ? "border-brand/40 bg-brand/15 hover:bg-brand/25"
                : "border-transparent bg-hover/60 hover:bg-hover"
            }`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span
              className={`text-xs font-medium ${
                hasReacted ? "text-brand" : "text-text-secondary"
              }`}
            >
              {userIds.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}
