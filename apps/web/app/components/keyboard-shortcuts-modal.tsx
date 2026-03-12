"use client";

import { SHORTCUTS, formatShortcut, Shortcut } from "../lib/keyboard-shortcuts";

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  const categories = ["Navigation", "Panels", "Actions"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-sidebar shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="max-h-96 overflow-y-auto p-4 scrollbar-hidden">
          {categories.map((category) => {
            const shortcuts = SHORTCUTS.filter((s) => s.category === category);
            if (shortcuts.length === 0) return null;

            return (
              <div key={category} className="mb-4 last:mb-0">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  {category}
                </h4>
                <div className="space-y-1.5">
                  {shortcuts.map((shortcut) => (
                    <ShortcutRow key={shortcut.action} shortcut={shortcut} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2.5">
          <p className="text-center text-[10px] text-text-secondary">
            Press <Kbd>Ctrl</Kbd> + <Kbd>/</Kbd> to toggle this dialog
          </p>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  const parts = formatShortcut(shortcut).split(" + ");

  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-hover/50">
      <span className="text-xs text-text-primary">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-0.5 text-[10px] text-text-secondary">+</span>}
            <Kbd>{part}</Kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-input px-1.5 py-0.5 text-[10px] font-medium text-text-primary shadow-sm">
      {children}
    </kbd>
  );
}
