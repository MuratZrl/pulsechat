"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Attachment } from "../types";
import { apiClient } from "../lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const SERVER_ORIGIN = API_BASE.replace(/\/api$/, "");

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
  onError: (message: string) => void;
}

export function ImagePreviewModal({
  file,
  dataUrl,
  onSend,
  onCancel,
  onError,
}: ImagePreviewModalProps) {
  const [isUploading, setIsUploading] = useState(false);

  async function handleSend() {
    if (isUploading) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Upload to R2 first, then emit the message with the returned URL.
      // Sending the FileReader data: URL straight through send_message used
      // to fail server-side (BadRequest: not from an allowed source) while
      // the modal closed anyway, so the UI looked successful but nothing
      // landed. Mirrors the attachment-picker upload flow.
      const data = await apiClient.upload<{
        url: string;
        name: string;
        size: string;
        type: "image" | "file" | "voice";
      }>("/upload", formData);

      const attachment: Attachment = {
        name: data.name,
        type: data.type,
        size: data.size,
        url: data.url.startsWith("http")
          ? data.url
          : `${SERVER_ORIGIN}${data.url}`,
      };
      onSend(attachment);
    } catch (err) {
      // Stay in the modal so the user can retry or cancel — surfacing the
      // error via toast instead of an inline banner mirrors the picker.
      onError(err instanceof Error ? err.message : "Upload failed");
      setIsUploading(false);
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={isUploading ? () => {} : onCancel}
      className="mx-4 flex max-w-lg flex-col rounded-lg border border-border bg-sidebar p-4 shadow-xl"
    >
      <p className="mb-3 text-sm font-semibold text-text-primary">
        Send Image
      </p>

      <div className="mb-3 overflow-hidden rounded-md bg-hover">
        <img
          src={dataUrl}
          alt={file.name}
          className="max-h-64 w-full object-contain"
        />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <p className="text-xs text-text-primary">{file.name}</p>
        <p className="text-xs text-text-secondary">
          {formatFileSize(file.size)}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={isUploading}
          className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={isUploading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Send"}
        </button>
      </div>
    </Modal>
  );
}
