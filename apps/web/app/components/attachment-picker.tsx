"use client";

import { useRef, useEffect, useState } from "react";
import { Attachment } from "../types";
import { getAccessToken } from "../lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const SERVER_ORIGIN = API_BASE.replace(/\/api$/, "");

interface AttachmentPickerProps {
  onSelect: (attachment: Attachment) => void;
  onClose: () => void;
}

export function AttachmentPicker({ onSelect, onClose }: AttachmentPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message ?? "Upload failed");
      }

      const data = await res.json() as {
        url: string;
        name: string;
        size: string;
        type: "image" | "file" | "voice";
      };

      onSelect({
        name: data.name,
        type: data.type,
        size: data.size,
        url: data.url.startsWith("http") ? data.url : `${SERVER_ORIGIN}${data.url}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-sidebar p-3 shadow-lg"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
        Upload File
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,audio/webm,audio/mp4,audio/mpeg"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-left transition-colors hover:bg-hover disabled:opacity-50"
      >
        {isUploading ? (
          <>
            <svg className="h-5 w-5 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-text-secondary">Uploading...</span>
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div>
              <p className="text-sm text-text-primary">Choose a file</p>
              <p className="text-[10px] text-text-secondary">Images, PDF, audio — max 10 MB</p>
            </div>
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
