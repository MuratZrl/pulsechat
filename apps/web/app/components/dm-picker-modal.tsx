"use client";

import { useState, useEffect } from "react";
import { Modal } from "./modal";
import { Avatar } from "./avatar";
import { apiClient } from "../lib/api-client";

interface AppUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
}

interface DmPickerModalProps {
  onClose: () => void;
  onSelect: (userId: string) => void;
}

export function DmPickerModal({ onClose, onSelect }: DmPickerModalProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiClient
      .get<AppUser[]>("/rooms/users/list")
      .then(setUsers)
      .catch(console.error);
  }, []);

  const filtered = search
    ? users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      className="mx-4 w-full max-w-md rounded-xl border border-border bg-sidebar shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/15">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-indigo-400"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-text-primary">
            New Direct Message
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 px-6 py-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          autoFocus
          className="block w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">
              No users found
            </p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => onSelect(u.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-hover"
              >
                <Avatar
                  name={u.name}
                  size="md"
                  avatarUrl={u.avatarUrl}
                  avatarPreset={u.avatarPreset}
                />
                {u.name}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
