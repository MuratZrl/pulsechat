"use client";

import { LinkPreviewData } from "../lib/link-preview";

interface LinkPreviewCardProps {
  preview: LinkPreviewData;
  isOwn: boolean;
}

export function LinkPreviewCard({ preview, isOwn }: LinkPreviewCardProps) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1.5 flex gap-2 rounded-md border-l-2 border-indigo-500 p-2 transition-colors ${
        isOwn
          ? "bg-indigo-700/40 hover:bg-indigo-700/60"
          : "bg-hover/60 hover:bg-hover"
      }`}
    >
      {/* Color thumbnail */}
      {preview.image && (
        <div
          className="h-14 w-14 flex-shrink-0 rounded-md"
          style={{ backgroundColor: preview.image }}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] ${isOwn ? "text-indigo-300" : "text-indigo-400"}`}>
          {preview.domain}
        </p>
        <p className={`truncate text-xs font-medium ${isOwn ? "text-white" : "text-text-primary"}`}>
          {preview.title}
        </p>
        <p className={`line-clamp-2 text-[10px] ${isOwn ? "text-indigo-200" : "text-text-secondary"}`}>
          {preview.description}
        </p>
      </div>
    </a>
  );
}
