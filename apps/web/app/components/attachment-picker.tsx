"use client";

import { useRef, useEffect } from "react";
import { Attachment } from "../types";
import { DEMO_ATTACHMENTS } from "../lib/mock-attachments";

interface AttachmentPickerProps {
  onSelect: (attachment: Attachment) => void;
  onClose: () => void;
}

export function AttachmentPicker({ onSelect, onClose }: AttachmentPickerProps) {
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

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-sidebar p-3 shadow-lg"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
        Demo Attachments
      </p>
      <div className="space-y-1">
        {DEMO_ATTACHMENTS.map((att) => (
          <button
            key={att.name}
            type="button"
            onClick={() => onSelect(att)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
          >
            {att.type === "image" ? (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-indigo-500/20 text-indigo-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
            ) : (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-text-secondary/20 text-text-secondary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text-primary">{att.name}</p>
              <p className="text-[10px] text-text-secondary">{att.size}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
