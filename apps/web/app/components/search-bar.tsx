"use client";

import { useRef, useEffect } from "react";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  resultCount: number;
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function SearchBar({
  query,
  onQueryChange,
  resultCount,
  activeIndex,
  onPrev,
  onNext,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      onPrev();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-border bg-sidebar px-4 py-2">
      {/* Search icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0 text-text-secondary"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search messages..."
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
      />

      {/* Result count */}
      {query && (
        <span className="flex-shrink-0 text-[10px] text-text-secondary">
          {resultCount > 0 ? `${activeIndex + 1} of ${resultCount}` : "No results"}
        </span>
      )}

      {/* Navigation */}
      {resultCount > 0 && (
        <div className="flex gap-0.5">
          <button
            onClick={onPrev}
            className="rounded p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
            title="Previous (Shift+Enter)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          <button
            onClick={onNext}
            className="rounded p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
            title="Next (Enter)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="rounded p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
