"use client";

import { useState, FormEvent } from "react";

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onCreate(trimmed);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-sidebar p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Create a new room
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name"
            autoFocus
            className="block w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
