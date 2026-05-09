"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Modal } from "./modal";
import { PRESET_AVATARS, AvatarPresetId } from "../lib/avatars";
import { apiClient } from "../lib/api-client";

export interface AvatarSelection {
  // Either a preset id, an R2 custom URL, or both null (cleared).
  // The component never emits both non-null at the same time.
  avatarUrl: string | null;
  avatarPreset: AvatarPresetId | null;
}

interface AvatarPickerProps {
  currentAvatarUrl?: string | null;
  currentAvatarPreset?: string | null;
  onSelect: (selection: AvatarSelection) => void;
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

function isPresetId(value: string | null | undefined): value is AvatarPresetId {
  if (!value) return false;
  return PRESET_AVATARS.some((p) => p.id === value);
}

export function AvatarPicker({
  currentAvatarUrl,
  currentAvatarPreset,
  onSelect,
  onClose,
}: AvatarPickerProps) {
  // Two parallel state slots — at most one is non-null at any moment. Picking
  // a preset clears the custom URL slot; uploading clears the preset slot.
  // "Remove" clears both. This mirrors the backend's mutual-exclusion rule
  // so Apply always emits a valid combination.
  const [selectedPreset, setSelectedPreset] = useState<AvatarPresetId | null>(
    isPresetId(currentAvatarPreset) ? currentAvatarPreset : null,
  );
  const [selectedCustomUrl, setSelectedCustomUrl] = useState<string | null>(
    // Preset takes precedence in the initial state — if both fields are
    // somehow set on the user record, treat the preset as authoritative.
    isPresetId(currentAvatarPreset) ? null : currentAvatarUrl ?? null,
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

  function handlePresetClick(presetId: AvatarPresetId) {
    setSelectedPreset(presetId);
    setSelectedCustomUrl(null);
  }

  function handleRemove() {
    setSelectedPreset(null);
    setSelectedCustomUrl(null);
  }

  function handleApply() {
    onSelect({
      avatarUrl: selectedCustomUrl,
      avatarPreset: selectedPreset,
    });
    onClose();
  }

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

      // Routed through apiClient so an expired access token gets a silent
      // /auth/refresh + retry instead of a hard 401. Previous raw fetch
      // bypassed that and failed the moment the token aged out (~15 min).
      const data = await apiClient.upload<{ url: string }>(
        "/upload",
        formData,
      );
      setSelectedCustomUrl(data.url);
      setSelectedPreset(null);
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
          {PRESET_AVATARS.map((avatar) => {
            const isSelected = selectedPreset === avatar.id;
            return (
              <button
                key={avatar.id}
                onClick={() => handlePresetClick(avatar.id)}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                  isSelected
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
            );
          })}
        </div>

        {/* Show the active custom upload preview if there is one and no preset
            is selected — gives the user feedback that their previous upload
            is still in effect. */}
        {selectedCustomUrl && !selectedPreset && (
          <div className="mb-4 flex items-center gap-3 rounded-md bg-active/50 px-3 py-2">
            <img
              src={selectedCustomUrl}
              alt="Custom avatar"
              className="h-10 w-10 rounded-full object-cover"
            />
            <span className="text-xs text-text-secondary">
              Custom upload selected
            </span>
          </div>
        )}

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
            onClick={handleRemove}
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
            onClick={handleApply}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
          >
            Apply
          </button>
        </div>
    </Modal>
  );
}
