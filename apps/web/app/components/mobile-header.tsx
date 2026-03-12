"use client";

interface MobileHeaderProps {
  roomName: string;
  onMenuToggle: () => void;
}

export function MobileHeader({ roomName, onMenuToggle }: MobileHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
      <button
        onClick={onMenuToggle}
        className="rounded-md p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <h1 className="text-sm font-semibold text-text-primary">
        <span className="mr-1 text-text-secondary">#</span>
        {roomName}
      </h1>
    </div>
  );
}
