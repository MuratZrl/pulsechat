"use client";

import { useRef, useState } from "react";
import { PRESET_AVATARS } from "../lib/avatars";

interface AvatarPickerProps {
  currentAvatarUrl?: string | null;
  onSelect: (avatarUrl: string | null) => void;
  onClose: () => void;
}

export function AvatarPicker({
  currentAvatarUrl,
  onSelect,
  onClose,
}: AvatarPickerProps) {
  const [selected, setSelected] = useState<string | null>(currentAvatarUrl || null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("Image must be under 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 128, 128);
        setSelected(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-sidebar p-5 shadow-xl">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          Choose Avatar
        </h3>

        <div className="mb-4 grid grid-cols-4 gap-3">
          {PRESET_AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => setSelected(avatar.url)}
              className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                selected === avatar.url
                  ? "bg-indigo-600/20 ring-2 ring-indigo-500"
                  : "hover:bg-hover"
              }`}
            >
              <img
                src={avatar.url}
                alt={avatar.label}
                className="h-12 w-12 rounded-full"
              />
              <span className="text-[10px] text-text-secondary">
                {avatar.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-md border border-border px-3 py-2 text-xs text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Upload custom
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-md border border-border px-3 py-2 text-xs text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Remove
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSelect(selected);
              onClose();
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
