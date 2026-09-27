"use client";

import { Attachment } from "../types";
import { useAttachmentUrl } from "../lib/attachment-url";

interface AttachmentCardProps {
  attachment: Attachment;
  isOwn: boolean;
  // Needed to request a signed URL for private (key-only) attachments.
  messageId?: string;
}

export function AttachmentCard({ attachment, isOwn, messageId }: AttachmentCardProps) {
  const src = useAttachmentUrl(messageId, attachment);

  if (attachment.type === "image" && (attachment.url || attachment.key)) {
    return (
      <div className="mt-1 overflow-hidden rounded-md">
        {src ? (
          <img
            src={src}
            alt={attachment.name}
            className="h-auto max-w-[200px] rounded-md"
          />
        ) : (
          // Placeholder while the signed URL is fetched.
          <div className="h-24 w-[200px] animate-pulse rounded-md bg-hover" />
        )}
        <p className={`mt-0.5 text-[10px] ${isOwn ? "text-indigo-200" : "text-text-secondary"}`}>
          {attachment.name} &middot; {attachment.size}
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-1 flex items-center gap-2 rounded-md border p-2 ${
      isOwn ? "border-indigo-500/30 bg-indigo-700/30" : "border-border bg-hover"
    }`}>
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded ${
        isOwn ? "bg-indigo-500/30 text-indigo-200" : "bg-text-secondary/20 text-text-secondary"
      }`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-medium ${isOwn ? "text-white" : "text-text-primary"}`}>
          {attachment.name}
        </p>
        <p className={`text-[10px] ${isOwn ? "text-indigo-200" : "text-text-secondary"}`}>
          {attachment.size}
        </p>
      </div>
    </div>
  );
}
