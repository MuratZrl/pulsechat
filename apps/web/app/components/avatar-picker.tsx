"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Modal } from "./modal";
import { PRESET_AVATARS } from "../lib/avatars";
import { getAccessToken } from "../lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

interface AvatarPickerProps {
  currentAvatarUrl?: string | null;
  onSelect: (avatarUrl: string | null) => void;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function getCroppedBlob(
  imageSrc: string,
  crop: Area
): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    128,
    128
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

export function AvatarPicker({
  currentAvatarUrl,
  onSelect,
  onClose,
}: AvatarPickerProps) {
  const [selected, setSelected] = useState<string | null>(
    currentAvatarUrl || null
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [fileName, setFileName] = useState<string>("avatar.png");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const onCropComplete = useCallback(
    (_: Area, croppedAreaPixels: Area) => {
      setCroppedArea(croppedAreaPixels);
    },
    []
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }

    setFileSize(file.size);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  async function handleCropAndUpload() {
    if (!cropImage || !croppedArea) return;

    setIsUploading(true);
    try {
      const blob = await getCroppedBlob(cropImage, croppedArea);
      const formData = new FormData();
      formData.append("file", blob, fileName);

      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setSelected(data.url);
      setCropImage(null);
    } catch {
      alert("Failed to upload avatar. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  // Crop view
  if (cropImage) {
    return (
      <Modal
        isOpen={true}
        onClose={() => setCropImage(null)}
        className="mx-4 w-full max-w-sm rounded-lg border border-border bg-sidebar p-5 shadow-xl"
      >
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            Crop Avatar
          </h3>

          {/* File info */}
          <div className="mb-3 flex items-center justify-between rounded-md bg-active/50 px-3 py-2">
            <span className="truncate text-xs text-text-secondary">
              {fileName}
            </span>
            <span className="ml-2 shrink-0 text-xs font-medium text-orange-500">
              {formatFileSize(fileSize)}
            </span>
          </div>

          {/* Crop area */}
          <div className="relative mb-3 h-64 w-full overflow-hidden rounded-lg bg-black">
            <Cropper
              image={cropImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Zoom slider */}
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs text-text-secondary">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-orange-500"
            />
            <span className="w-8 text-right text-xs text-text-secondary">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setCropImage(null)}
              className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary"
            >
              Back
            </button>
            <button
              onClick={handleCropAndUpload}
              disabled={isUploading}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : "Crop & Upload"}
            </button>
          </div>
      </Modal>
    );
  }

  // Pick view (presets + upload button)
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      className="mx-4 w-full max-w-sm rounded-lg border border-border bg-sidebar p-5 shadow-xl"
    >
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
                  ? "bg-orange-600/20 ring-2 ring-orange-500"
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
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
          >
            Apply
          </button>
        </div>
    </Modal>
  );
}
