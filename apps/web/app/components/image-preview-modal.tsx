"use client";

import { Attachment } from "../types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

interface ImagePreviewModalProps {
  file: File;
  dataUrl: string;
  onSend: (attachment: Attachment) => void;
  onCancel: () => void;
}

export function ImagePreviewModal({
  file,
  dataUrl,
  onSend,
  onCancel,
}: ImagePreviewModalProps) {
  function handleSend() {
    const attachment: Attachment = {
      name: file.name,
      type: "image",
      size: formatFileSize(file.size),
      url: dataUrl,
    };
    onSend(attachment);
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 flex max-w-lg flex-col rounded-lg border border-border bg-sidebar p-4 shadow-xl">
        <p className="mb-3 text-sm font-semibold text-text-primary">
          Send Image
        </p>

        {/* Preview */}
        <div className="mb-3 overflow-hidden rounded-md bg-hover">
          <img
            src={dataUrl}
            alt={file.name}
            className="max-h-64 w-full object-contain"
          />
        </div>

        {/* File info */}
        <div className="mb-4 flex items-center gap-2">
          <p className="text-xs text-text-primary">{file.name}</p>
          <p className="text-xs text-text-secondary">
            {formatFileSize(file.size)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
