interface DropZoneOverlayProps {
  visible: boolean;
}

export function DropZoneOverlay({ visible }: DropZoneOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-indigo-600/10 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-indigo-400 bg-sidebar/80 px-10 py-8">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-indigo-400"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm font-medium text-indigo-400">
          Drop image here
        </p>
        <p className="text-xs text-text-secondary">
          JPG, PNG, GIF, or WebP
        </p>
      </div>
    </div>
  );
}
