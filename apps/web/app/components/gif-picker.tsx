"use client";

import { useState, useEffect, useRef } from "react";
import { getGifs, GIF_CATEGORIES, MockGif } from "../lib/mock-gifs";

interface GifPickerProps {
  onSelect: (gif: MockGif) => void;
  onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [gifs, setGifs] = useState<MockGif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGifs(getGifs(category, search));
  }, [category, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-12 left-0 z-50 w-72 rounded-lg border border-border bg-sidebar shadow-xl"
    >
      {/* Header */}
      <div className="border-b border-border p-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search GIFs..."
          className="w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none"
          autoFocus
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5 scrollbar-hidden">
        {GIF_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
              category === cat
                ? "bg-indigo-600 text-white"
                : "text-text-secondary hover:bg-hover hover:text-text-primary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* GIF Grid */}
      <div className="grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto p-2 scrollbar-hidden">
        {gifs.length === 0 ? (
          <p className="col-span-2 py-4 text-center text-xs text-text-secondary">
            No GIFs found
          </p>
        ) : (
          gifs.map((gif) => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif)}
              className="group relative flex h-20 items-center justify-center overflow-hidden rounded-md transition-transform hover:scale-105"
              style={{ backgroundColor: gif.color }}
            >
              <span className="text-2xl drop-shadow-md">
                {gif.category === "Reactions" && "👋"}
                {gif.category === "Funny" && "😂"}
                {gif.category === "Love" && "❤️"}
                {gif.category === "Celebrate" && "🎉"}
              </span>
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {gif.title}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
