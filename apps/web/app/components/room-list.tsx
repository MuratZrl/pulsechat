"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Room } from "../types";
import { getUnreadCount, setLastRead } from "../lib/unread";
import { useAuth } from "../contexts/auth-context";
import { apiClient } from "../lib/api-client";
import { CreateRoomModal } from "./create-room-modal";
import {
  getRoomCategory,
  setRoomCategory,
  getCategories,
} from "../lib/room-categories";

interface RoomListProps {
  onNavigate?: () => void;
  onUnreadChange?: (total: number) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function RoomList({ onNavigate, onUnreadChange, searchInputRef }: RoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [categoryMenu, setCategoryMenu] = useState<{
    roomId: string;
    x: number;
    y: number;
  } | null>(null);
  const pathname = usePathname();
  const { user } = useAuth();
  const localSearchRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || localSearchRef;

  useEffect(() => {
    apiClient.get<Room[]>("/rooms").then(setRooms).catch(console.error);
  }, []);

  // Compute unread counts and mark active room as read
  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const room of rooms) {
      counts[room.id] = getUnreadCount(room.id);
    }

    const activeRoomId = rooms.find((r) => pathname === `/chat/${r.id}`)?.id;
    if (activeRoomId) {
      setLastRead(activeRoomId, new Date().toISOString());
      counts[activeRoomId] = 0;
    }

    setUnreadCounts(counts);

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    onUnreadChange?.(total);
  }, [rooms, pathname, onUnreadChange]);

  const filteredRooms = search
    ? rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : rooms;

  // Group rooms by category
  const groupedRooms = useMemo(() => {
    const groups: Record<string, Room[]> = {};
    const categories = getCategories();

    for (const room of filteredRooms) {
      const cat = getRoomCategory(room.id);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(room);
    }

    // Sort categories to match default order
    const ordered: [string, Room[]][] = [];
    for (const cat of categories) {
      if (groups[cat]) {
        ordered.push([cat, groups[cat]]);
        delete groups[cat];
      }
    }
    // Any remaining categories
    for (const [cat, rooms] of Object.entries(groups)) {
      ordered.push([cat, rooms]);
    }

    return ordered;
  }, [filteredRooms]);

  async function handleCreateRoom(name: string) {
    if (!user) return;
    try {
      const room = await apiClient.post<Room>("/rooms", { name });
      setRooms((prev) => [...prev, room]);
    } catch (e) {
      console.error("Failed to create room:", e);
    }
    setShowModal(false);
  }

  function toggleCollapsed(cat: string) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  function handleContextMenu(e: React.MouseEvent, roomId: string) {
    e.preventDefault();
    setCategoryMenu({ roomId, x: e.clientX, y: e.clientY });
  }

  function handleCategoryChange(roomId: string, category: string) {
    setRoomCategory(roomId, category);
    setCategoryMenu(null);
    // Force re-render
    setRooms([...rooms]);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 pl-8 text-sm text-text-primary placeholder:text-text-secondary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {filteredRooms.length === 0 && search && (
          <p className="px-4 py-3 text-xs text-text-secondary">No rooms found</p>
        )}

        {/* If searching, show flat list */}
        {search ? (
          filteredRooms.map((room) => {
            const isActive = pathname === `/chat/${room.id}`;
            const unread = unreadCounts[room.id] || 0;
            return (
              <Link
                key={room.id}
                href={`/chat/${room.id}`}
                onClick={onNavigate}
                className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-active font-medium text-text-primary"
                    : "text-text-secondary hover:bg-hover hover:text-text-primary"
                }`}
              >
                <span>
                  <span className="mr-2 text-text-secondary">#</span>
                  {room.name}
                </span>
                {unread > 0 && !isActive && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })
        ) : (
          /* Categorized view */
          groupedRooms.map(([category, categoryRooms]) => (
            <div key={category}>
              {/* Category header */}
              <button
                onClick={() => toggleCollapsed(category)}
                className="flex w-full items-center gap-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform ${collapsed[category] ? "" : "rotate-90"}`}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                {category}
                <span className="ml-auto text-[10px] font-normal">
                  {categoryRooms.length}
                </span>
              </button>

              {/* Category rooms */}
              {!collapsed[category] &&
                categoryRooms.map((room) => {
                  const isActive = pathname === `/chat/${room.id}`;
                  const unread = unreadCounts[room.id] || 0;
                  return (
                    <Link
                      key={room.id}
                      href={`/chat/${room.id}`}
                      onClick={onNavigate}
                      onContextMenu={(e) => handleContextMenu(e, room.id)}
                      className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-active font-medium text-text-primary"
                          : "text-text-secondary hover:bg-hover hover:text-text-primary"
                      }`}
                    >
                      <span>
                        <span className="mr-2 text-text-secondary">#</span>
                        {room.name}
                      </span>
                      {unread > 0 && !isActive && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">
                          {unread}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-3">
        <button
          onClick={() => setShowModal(true)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
        >
          + New Room
        </button>
      </div>

      {showModal && (
        <CreateRoomModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreateRoom}
        />
      )}

      {/* Category context menu */}
      {categoryMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setCategoryMenu(null)}
          />
          <div
            className="fixed z-50 w-36 rounded-md border border-border bg-sidebar py-1 shadow-xl"
            style={{ left: categoryMenu.x, top: categoryMenu.y }}
          >
            <p className="px-3 py-1 text-[10px] font-semibold uppercase text-text-secondary">
              Move to
            </p>
            {getCategories().map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(categoryMenu.roomId, cat)}
                className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                  getRoomCategory(categoryMenu.roomId) === cat
                    ? "bg-indigo-600 text-white"
                    : "text-text-secondary hover:bg-hover hover:text-text-primary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
