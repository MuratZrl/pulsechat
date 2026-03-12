"use client";

interface LogoutDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function LogoutDialog({ onConfirm, onCancel }: LogoutDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-sidebar p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary">Log out?</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Are you sure you want to log out?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
