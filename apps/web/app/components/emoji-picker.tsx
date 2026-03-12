"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_DATA: { category: string; emojis: string[] }[] = [
  {
    category: "Smileys",
    emojis: [
      "😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎",
      "🤔", "😐", "😑", "😶", "🙄", "😏", "😣", "😢",
      "😭", "😤", "🤯", "😱", "🥳", "😴", "🤮", "🤡",
    ],
  },
  {
    category: "Gestures",
    emojis: [
      "👍", "👎", "👏", "🙌", "🤝", "🙏", "✌️", "🤞",
      "👋", "💪", "🫡", "🫶", "👀", "🧠", "💀", "🫠",
    ],
  },
  {
    category: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💔", "❤️‍🔥", "💯", "💢", "💥", "✨", "🔥", "⭐",
    ],
  },
  {
    category: "Objects",
    emojis: [
      "🎉", "🎊", "🎁", "🏆", "🎯", "🚀", "💡", "📌",
      "✅", "❌", "⚠️", "💬", "📝", "🔔", "⏰", "🎵",
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const filtered = search
    ? EMOJI_DATA.map((g) => ({
        ...g,
        emojis: g.emojis.filter((e) => e.includes(search)),
      })).filter((g) => g.emojis.length > 0)
    : EMOJI_DATA;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-border bg-sidebar p-3 shadow-lg"
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search emoji..."
        autoFocus
        className="mb-2 w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none"
      />
      <div className="max-h-48 overflow-y-auto scrollbar-hidden">
        {filtered.length === 0 && (
          <p className="py-2 text-center text-xs text-text-secondary">No emoji found</p>
        )}
        {filtered.map((group) => (
          <div key={group.category} className="mb-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {group.category}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded hover:bg-hover text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
