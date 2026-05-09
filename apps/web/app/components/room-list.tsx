"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Room } from "../types";
import { useAuth } from "../contexts/auth-context";
import { apiClient } from "../lib/api-client";
import { useSocket } from "../hooks/useSocket";
import { CreateRoomModal } from "./create-room-modal";
import { DmPickerModal } from "./dm-picker-modal";
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
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [categoryMenu, setCategoryMenu] = useState<{ roomId: string; x: number; y: number } | null>(null);
  const [showDmList, setShowDmList] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const { socket } = useSocket();
  const localSearchRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || localSearchRef;

  // Load rooms from API
  const loadRooms = useCallback(() => {
    apiClient.get<Room[]>("/rooms").then(setRooms).catch(console.error);
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Latest-rooms ref so the mark-read effect can read current state without
  // depending on `rooms` (which would re-trigger after every setRooms and
  // relied on the unreadCount==0 short-circuit to avoid an infinite loop —
  // a fragile pattern that breaks the moment any future change touches
  // setRooms unconditionally).
  const roomsRef = useRef<Room[]>([]);
  roomsRef.current = rooms;

  // Optimistically clear the active room's unread/mention badges on navigate.
  // The actual API call (POST /rooms/:id/read) now lives in the chat page,
  // deferred ~1.5s after mount or fired immediately on send. That decoupling
  // lets the page snapshot the pre-advance lastReadAt for its unread
  // separator without racing the mark-read write. If the user navigates
  // away within the 1.5s window the API call won't fire and the next
  // /rooms refresh will repopulate the badge — acceptable trade-off for
  // instant visual feedback on click.
  useEffect(() => {
    const activeRoom = roomsRef.current.find((r) => pathname === `/chat/${r.id}`);
    if (!activeRoom) return;
    if ((activeRoom.unreadCount ?? 0) > 0 || (activeRoom.mentionCount ?? 0) > 0) {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoom.id ? { ...r, unreadCount: 0, mentionCount: 0 } : r
        )
      );
    }
  }, [pathname]);

  // Real-time: increment unread count when a new message arrives in another room
  useEffect(() => {
    if (!socket || !user) return;

    const onNewMessage = (msg: { roomId: string; senderId: string }) => {
      const activeRoomId = pathname.startsWith("/chat/")
        ? pathname.replace("/chat/", "")
        : null;

      // Don't increment for the currently viewed room or own messages
      if (msg.roomId === activeRoomId) return;
      if (msg.senderId === user.id) return;

      setRooms((prev) =>
        prev.map((r) =>
          r.id === msg.roomId
            ? { ...r, unreadCount: (r.unreadCount ?? 0) + 1 }
            : r
        )
      );
    };

    const onMention = (payload: { roomId: string }) => {
      const activeRoomId = pathname.startsWith("/chat/")
        ? pathname.replace("/chat/", "")
        : null;
      if (payload.roomId === activeRoomId) return;

      setRooms((prev) =>
        prev.map((r) =>
          r.id === payload.roomId
            ? { ...r, mentionCount: (r.mentionCount ?? 0) + 1 }
            : r
        )
      );
    };

    socket.on("new_message", onNewMessage);
    socket.on("mention", onMention);
    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("mention", onMention);
    };
  }, [socket, user, pathname]);

  // Propagate total unread count up
  useEffect(() => {
    const total = rooms.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);
    onUnreadChange?.(total);
  }, [rooms, onUnreadChange]);

  const channels = useMemo(
    () => rooms.filter((r) => r.type !== "DM"),
    [rooms]
  );
  const dms = useMemo(
    () => rooms.filter((r) => r.type === "DM"),
    [rooms]
  );

  const filteredChannels = search
    ? channels.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : channels;

  const filteredDms = search
    ? dms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : dms;

  // Group channels by category
  const groupedChannels = useMemo(() => {
    const groups: Record<string, Room[]> = {};
    const categories = getCategories();
    for (const room of filteredChannels) {
      const cat = getRoomCategory(room.id);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(room);
    }
    const ordered: [string, Room[]][] = [];
    for (const cat of categories) {
      if (groups[cat]) { ordered.push([cat, groups[cat]]); delete groups[cat]; }
    }
    for (const [cat, r] of Object.entries(groups)) ordered.push([cat, r]);
    return ordered;
  }, [filteredChannels]);

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

  async function handleStartDm(targetUserId: string) {
    try {
      const dm = await apiClient.post<{ id: string; name: string; type: string; isNew: boolean }>(
        `/rooms/dm/${targetUserId}`, {}
      );
      setShowDmList(false);
      // Add/refresh DM room in list
      loadRooms();
      // Navigate to DM
      window.location.href = `/chat/${dm.id}`;
    } catch (e) {
      console.error("Failed to start DM:", e);
    }
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
    setRooms([...rooms]);
  }

  function RoomLink({ room, prefix = "#" }: { room: Room; prefix?: string }) {
    const isActive = pathname === `/chat/${room.id}`;
    const unread = room.unreadCount ?? 0;
    const mentions = room.mentionCount ?? 0;

    // Discord-style row states. Selection != unread, so active rows are
    // never bold even if the underlying channel had unread before clicking.
    // Hover bg uses the same token at lower alpha so the row never goes
    // fully opaque on hover — that's reserved for the active row.
    const stateClasses = isActive
      ? "bg-hover/40 text-text-primary"
      : unread > 0
        ? "font-semibold text-text-primary hover:bg-hover/20"
        : "text-text-secondary hover:bg-hover/20 hover:text-text-primary";

    return (
      <Link
        href={`/chat/${room.id}`}
        onClick={onNavigate}
        onContextMenu={prefix === "#" ? (e) => handleContextMenu(e, room.id) : undefined}
        className={`mx-2 flex items-center justify-between rounded-md px-2 py-1 text-sm transition-colors duration-100 ${stateClasses}`}
      >
        <span className="min-w-0 truncate">
          <span className="mr-1.5 text-text-quaternary">{prefix}</span>
          {room.name}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {mentions > 0 && !isActive && (
            <span className="min-w-[20px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-semibold text-white">
              @{mentions}
            </span>
          )}
          {unread > 0 && !isActive && (
            <span className="min-w-[20px] rounded-full bg-brand px-1.5 py-0.5 text-center text-xs font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
      </Link>
    );
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
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 pl-8 text-sm text-text-primary placeholder:text-text-secondary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {/* Channels */}
        {groupedChannels.map(([category, categoryRooms]) => (
          <div key={category}>
            <button
              onClick={() => toggleCollapsed(category)}
              className="flex w-full items-center gap-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${collapsed[category] ? "" : "rotate-90"}`}>
                <path d="m9 18 6-6-6-6" />
              </svg>
              {category}
              <span className="ml-auto text-[10px] font-normal">{categoryRooms.length}</span>
            </button>
            {!collapsed[category] && categoryRooms.map((room) => (
              <RoomLink key={room.id} room={room} />
            ))}
          </div>
        ))}

        {/* Direct Messages section */}
        <div>
          <div className="flex w-full items-center gap-1 px-3 py-1.5">
            <button
              onClick={() => toggleCollapsed("__dms")}
              className="flex flex-1 items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${collapsed["__dms"] ? "" : "rotate-90"}`}>
                <path d="m9 18 6-6-6-6" />
              </svg>
              Direct Messages
              {dms.length > 0 && <span className="ml-auto text-[10px] font-normal">{dms.length}</span>}
            </button>
            <button
              onClick={() => setShowDmList(true)}
              title="New Direct Message"
              className="ml-1 rounded p-0.5 text-text-secondary hover:bg-hover hover:text-text-primary"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          {!collapsed["__dms"] && filteredDms.map((room) => (
            <RoomLink key={room.id} room={room} prefix="@" />
          ))}
          {!collapsed["__dms"] && dms.length === 0 && (
            <p className="px-4 py-1.5 text-xs text-text-secondary">
              No DMs yet —{" "}
              <button onClick={() => setShowDmList(true)} className="text-indigo-400 hover:underline">start one</button>
            </p>
          )}
        </div>
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
        <CreateRoomModal onClose={() => setShowModal(false)} onCreate={handleCreateRoom} />
      )}

      {/* Category context menu */}
      {categoryMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setCategoryMenu(null)} />
          <div className="fixed z-50 w-36 rounded-md border border-border bg-sidebar py-1 shadow-xl" style={{ left: categoryMenu.x, top: categoryMenu.y }}>
            <p className="px-3 py-1 text-[10px] font-semibold uppercase text-text-secondary">Move to</p>
            {getCategories().map((cat) => (
              <button key={cat} onClick={() => handleCategoryChange(categoryMenu.roomId, cat)}
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

      {showDmList && (
        <DmPickerModal
          onClose={() => setShowDmList(false)}
          onSelect={handleStartDm}
        />
      )}
    </div>
  );
}
