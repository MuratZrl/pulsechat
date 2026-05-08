"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchTrending,
  searchGifs,
  isGiphyConfigured,
  PRESET_CATEGORIES,
  type GiphyGif,
} from "../lib/giphy";

interface GifPickerProps {
  onSelect: (gif: GiphyGif) => void;
  onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const configured = isGiphyConfigured();

  // Click-outside close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // 300ms debounce so we don't hammer GIPHY on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Initial fetch + re-fetch on debounced query change. The cancelled flag
  // protects against a stale resolve clobbering newer state when the user
  // types another character before the previous request returns.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const page = debouncedSearch
          ? await searchGifs(debouncedSearch)
          : await fetchTrending();
        if (cancelled) return;
        setGifs(page.results);
        setOffset(page.offset + page.count);
        setTotalCount(page.totalCount);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load GIFs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, configured]);

  const handleLoadMore = useCallback(async () => {
    if (!configured || loadingMore || offset >= totalCount) return;
    setLoadingMore(true);
    try {
      const page = debouncedSearch
        ? await searchGifs(debouncedSearch, offset)
        : await fetchTrending(offset);
      setGifs((prev) => [...prev, ...page.results]);
      setOffset(page.offset + page.count);
      setTotalCount(page.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [configured, debouncedSearch, offset, totalCount, loadingMore]);

  if (!configured) {
    return (
      <div
        ref={ref}
        className="absolute bottom-12 left-0 z-50 w-72 rounded-lg border border-border bg-sidebar p-3 shadow-xl"
      >
        <p className="text-sm font-medium text-text-primary">
          GIPHY API key not configured
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Set <span className="font-mono">NEXT_PUBLIC_GIPHY_API_KEY</span> in{" "}
          <span className="font-mono">apps/web/.env.local</span>. Get a key at{" "}
          <a
            href="https://developers.giphy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            developers.giphy.com
          </a>
          .
        </p>
      </div>
    );
  }

  const hasMore = offset < totalCount;

  return (
    <div
      ref={ref}
      className="absolute bottom-12 left-0 z-50 w-80 rounded-lg border border-border bg-sidebar shadow-xl"
    >
      {/* Search */}
      <div className="border-b border-border p-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search GIPHY..."
          className="w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:border-brand focus:outline-none"
          autoFocus
        />
      </div>

      {/* Preset category tabs — one-tap search queries */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5 scrollbar-hidden">
        {PRESET_CATEGORIES.map((cat) => {
          const active = debouncedSearch === cat;
          return (
            <button
              key={cat}
              onClick={() => setSearch(cat)}
              className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:bg-hover hover:text-text-primary"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Results grid */}
      <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto p-2 scrollbar-hidden">
        {loading && gifs.length === 0 ? (
          // Skeleton: 6 placeholders during initial fetch.
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-md bg-hover" />
          ))
        ) : error ? (
          <p className="col-span-2 py-4 text-center text-xs text-red-400">
            {error}
          </p>
        ) : gifs.length === 0 ? (
          <p className="col-span-2 py-4 text-center text-xs text-text-secondary">
            No GIFs found
          </p>
        ) : (
          <>
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif)}
                className="group relative overflow-hidden rounded-md bg-hover transition-transform hover:scale-[1.02]"
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  loading="lazy"
                  className="h-24 w-full object-cover"
                />
              </button>
            ))}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="col-span-2 mt-1 rounded-md py-1.5 text-xs text-text-secondary transition-colors hover:bg-hover hover:text-text-primary disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Required GIPHY attribution */}
      <div className="border-t border-border px-2 py-1 text-center text-[10px] text-text-secondary">
        Powered by GIPHY
      </div>
    </div>
  );
}
