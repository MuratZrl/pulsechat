"use client";

import { useState, useEffect } from "react";
import { Modal } from "./modal";
import { Message } from "../types";
import { apiClient } from "../lib/api-client";

interface RoomItem {
  id: string;
  name: string;
  type: string;
}

interface ForwardMessageModalProps {
  message: Message;
  currentRoomId: string;
  onForward: (targetRoomId: string, targetRoomName: string) => void;
  onClose: () => void;
}

export function ForwardMessageModal({
  message,
  currentRoomId,
  onForward,
  onClose,
}: ForwardMessageModalProps) {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<RoomItem | null>(null);

  useEffect(() => {
    apiClient
      .get<RoomItem[]>("/rooms")
      .then((all) => setRooms(all.filter((r) => r.id !== currentRoomId)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentRoomId]);

  const filtered = search
    ? rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : rooms;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      className="mx-4 w-full max-w-sm rounded-lg border border-border bg-sidebar shadow-xl"
    >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Forward Message
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

        {/* Message preview */}
        <div className="border-b border-border px-4 py-2">
          <p className="text-[10px] text-text-secondary">Message from {message.senderName}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-text-primary">
            {message.text}
          </p>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Room list */}
        <div className="max-h-48 overflow-y-auto px-2 pb-2 scrollbar-hidden">
          {loading ? (
            <div className="flex justify-center py-4">
              <svg className="h-4 w-4 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-text-secondary">
              No other rooms available
            </p>
          ) : (
            filtered.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedRoom?.id === room.id
                    ? "bg-indigo-600 text-white"
                    : "text-text-secondary hover:bg-hover hover:text-text-primary"
                }`}
              >
                <span className={selectedRoom?.id === room.id ? "text-indigo-200" : "text-text-secondary"}>
                  {room.type === "DM" ? "@" : "#"}
                </span>
                {room.name}
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedRoom) {
                onForward(selectedRoom.id, selectedRoom.name);
              }
            }}
            disabled={!selectedRoom}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Forward
          </button>
        </div>
    </Modal>
  );
}
