"use client";

import { useState, useEffect, useCallback, useRef, useMemo, use } from "react";
import { Message, Attachment, Reactions, OnlineUser } from "../../types";
import { ReadReceipt } from "../../lib/read-receipts";
import { useAuth } from "../../contexts/auth-context";
import { apiClient } from "../../lib/api-client";
import { useSocket } from "../../hooks/useSocket";
import { MessageList } from "../../components/message-list";
import { MessageInput } from "../../components/message-input";
import { OnlineUsers } from "../../components/online-users";
import { TypingIndicator } from "../../components/typing-indicator";
import { UserProfilePopover } from "../../components/user-profile-popover";
import { PinnedMessagesPanel } from "../../components/pinned-messages-panel";
import { SearchBar } from "../../components/search-bar";
import { DropZoneOverlay } from "../../components/drop-zone-overlay";
import { ImagePreviewModal } from "../../components/image-preview-modal";
import { ThreadPanel } from "../../components/thread-panel";
import { playNotificationSound } from "../../lib/sounds";
import { ForwardMessageModal } from "../../components/forward-message-modal";
import { StarredMessagesPanel } from "../../components/starred-messages-panel";
import { useToast } from "../../components/toast";
import { canInvite, setRoomRoles } from "../../lib/room-roles";
import { InviteLinkModal } from "../../components/invite-link-modal";
import { KeyboardShortcutsModal } from "../../components/keyboard-shortcuts-modal";

interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
}

export default function ChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const { user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState<"CHANNEL" | "DM">("CHANNEL");
  const [showMembers, setShowMembers] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // Typing — per-user with independent timeouts
  const [typingUsers, setTypingUsers] = useState<
    Map<string, { name: string; timeout: number }>
  >(new Map());
  const typingNames = useMemo(
    () => Array.from(typingUsers.values()).map((u) => u.name),
    [typingUsers]
  );

  // Reply
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Pins
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [showPinned, setShowPinned] = useState(false);

  // Scroll-to (pinned jump / search navigation)
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(
    null
  );

  // Profile popover
  const [profilePopover, setProfilePopover] = useState<{
    userId: string;
    userName: string;
    userStatus: "online" | "idle" | "offline";
    anchorRect: DOMRect;
  } | null>(null);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultIds, setSearchResultIds] = useState<string[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Read receipts
  const [readReceipts, setReadReceipts] = useState<
    Record<string, ReadReceipt[]>
  >({});

  // Drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<{
    file: File;
    dataUrl: string;
  } | null>(null);
  const dragCounterRef = useRef(0);

  // Thread
  const [activeThread, setActiveThread] = useState<Message | null>(null);

  // Pagination
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Forward
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  // Starred
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [showStarred, setShowStarred] = useState(false);

  // Invite
  const [showInvite, setShowInvite] = useState(false);

  // Keyboard shortcuts
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Mark-read state. The snapshot is captured from /rooms/:id on initial
  // mount and stays fixed for the page's lifetime so the unread separator
  // stays anchored even after the server-side lastReadAt advances. firedRef
  // makes the API call idempotent within a room visit; timerRef holds the
  // deferred-fire setTimeout so cleanup can cancel it on fast navigate.
  const [lastReadSnapshot, setLastReadSnapshot] = useState<string | null>(null);
  const markReadFiredRef = useRef(false);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fireMarkRead = useCallback(() => {
    if (markReadFiredRef.current) return;
    markReadFiredRef.current = true;
    if (markReadTimerRef.current) {
      clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = null;
    }
    apiClient.post(`/rooms/${roomId}/read`, {}).catch(console.error);
  }, [roomId]);

  // Deferred mark-read: 1.5s after the snapshot is captured. Cleanup on
  // roomId/snapshot change cancels the pending fire if the user navigates
  // away before the timer expires — covers the "open then immediately
  // navigate" case where we want the room to stay unread.
  useEffect(() => {
    markReadFiredRef.current = false;
    if (!lastReadSnapshot) return;
    markReadTimerRef.current = setTimeout(fireMarkRead, 1500);
    return () => {
      if (markReadTimerRef.current) {
        clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = null;
      }
    };
  }, [roomId, lastReadSnapshot, fireMarkRead]);

  // Reply count map (derived)
  const replyCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    messages.forEach((m) => {
      if (m.replyToId && !m.isDeleted) {
        map[m.replyToId] = (map[m.replyToId] || 0) + 1;
      }
    });
    return map;
  }, [messages]);

  // --- Init: fetch messages + room name from API ---
  // Each fetch is wired to a shared AbortController so that fast room
  // switches don't let an earlier room's response overwrite the newer
  // room's state. Cleanup aborts any still-pending requests; fetch rejects
  // with a DOMException whose name === 'AbortError', which we filter out.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const isAbort = (err: unknown) =>
      err instanceof DOMException && err.name === "AbortError";

    apiClient
      .get<PaginatedMessages>(`/rooms/${roomId}/messages?limit=30`, signal)
      .then(({ messages: initial, hasMore: more }) => {
        setMessages(initial);
        setHasMore(more);
      })
      .catch((err) => {
        if (!isAbort(err)) console.error(err);
      });

    apiClient
      .get<{
        id: string;
        name: string;
        type?: "CHANNEL" | "DM";
        members?: { userId: string; role: string }[];
        lastReadAt?: string;
      }>(`/rooms/${roomId}`, signal)
      .then((room) => {
        setRoomName(room.name);
        setRoomType(room.type ?? "CHANNEL");
        // Populate in-memory role cache for badge rendering and canInvite checks
        if (room.members) setRoomRoles(roomId, room.members);
        // Snapshot the lastReadAt for the unread separator. Captured here,
        // before the deferred fireMarkRead can advance the server's value,
        // so the marker boundary reflects "what was unread when I opened
        // this room" rather than racing the mark-read API call.
        if (room.lastReadAt) setLastReadSnapshot(room.lastReadAt);
      })
      .catch((err) => {
        if (!isAbort(err)) setRoomName("Unknown Room");
      });

    apiClient
      .get<string[]>(`/rooms/${roomId}/pins`, signal)
      .then(setPinnedIds)
      .catch((err) => {
        if (!isAbort(err)) {
          /* silent — pins are non-critical */
        }
      });

    apiClient
      .get<{ messageId: string }[]>(`/stars`, signal)
      .then((entries) => setStarredIds(entries.map((e) => e.messageId)))
      .catch((err) => {
        if (!isAbort(err)) {
          /* silent — stars are non-critical */
        }
      });

    return () => controller.abort();
  }, [roomId]);

  // --- Socket event listeners ---
  useEffect(() => {
    if (!socket || !user) return;

    // No explicit join_room emit — the gateway's connection handler
    // auto-joins every room the user is a member of, so this socket is
    // already in `roomId` by the time we arrive here. The previous emit
    // raced the connection-time auth (client.userId set after a Prisma
    // lookup) and produced a swallowed PrismaClientValidationError on
    // every page mount.

    const onNewMessage = (msg: Message) => {
      if (msg.roomId !== roomId) return;
      setMessages((prev) => [...prev, msg]);
      if (msg.senderId !== user.id) {
        playNotificationSound();
      }
    };

    const onMessageEdited = (payload: {
      messageId: string;
      text: string;
      editedAt: string;
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, text: payload.text, editedAt: payload.editedAt }
            : m
        )
      );
    };

    const onMessageDeleted = (payload: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, isDeleted: true, text: "" }
            : m
        )
      );
    };

    const onUserTyping = (payload: {
      roomId: string;
      userId: string;
      userName: string;
    }) => {
      if (payload.roomId !== roomId || payload.userId === user.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const existing = next.get(payload.userId);
        if (existing) clearTimeout(existing.timeout);
        const timeoutId = window.setTimeout(() => {
          setTypingUsers((p) => {
            const n = new Map(p);
            n.delete(payload.userId);
            return n;
          });
        }, 3000);
        next.set(payload.userId, { name: payload.userName, timeout: timeoutId });
        return next;
      });
    };

    const onUserStopTyping = (payload: {
      roomId: string;
      userId: string;
    }) => {
      if (payload.roomId !== roomId) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const existing = next.get(payload.userId);
        if (existing) clearTimeout(existing.timeout);
        next.delete(payload.userId);
        return next;
      });
    };

    const onRoomUsers = (payload: {
      roomId: string;
      users: OnlineUser[];
    }) => {
      if (payload.roomId === roomId) {
        setOnlineUsers(payload.users);
      }
    };

    const onReactionUpdated = (payload: {
      messageId: string;
      reactions: Reactions;
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m
        )
      );
    };

    const onReadReceipt = (payload: {
      messageId: string;
      userId: string;
      userName: string;
      readAt: string;
    }) => {
      setReadReceipts((prev) => {
        const existing = prev[payload.messageId] || [];
        if (existing.some((r) => r.userId === payload.userId)) return prev;
        return {
          ...prev,
          [payload.messageId]: [
            ...existing,
            { userId: payload.userId, userName: payload.userName, readAt: payload.readAt },
          ],
        };
      });
    };

    socket.on("new_message", onNewMessage);
    socket.on("message_edited", onMessageEdited);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("user_typing", onUserTyping);
    socket.on("user_stop_typing", onUserStopTyping);
    socket.on("room_users", onRoomUsers);
    socket.on("reaction_updated", onReactionUpdated);
    socket.on("read_receipt", onReadReceipt);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("message_edited", onMessageEdited);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("user_typing", onUserTyping);
      socket.off("user_stop_typing", onUserStopTyping);
      socket.off("room_users", onRoomUsers);
      socket.off("reaction_updated", onReactionUpdated);
      socket.off("read_receipt", onReadReceipt);
      // No leave_room emit — the socket stays in every member room for the
      // lifetime of the connection so the sidebar's RoomList can keep
      // receiving new_message broadcasts and update unread counts for rooms
      // the user isn't currently viewing.
    };
  }, [socket, roomId, user]);

  // Load read receipts from API whenever the message list changes
  useEffect(() => {
    const ids = messages.map((m) => m.id);
    if (!ids.length) return;
    apiClient
      .get<Record<string, ReadReceipt[]>>(
        `/rooms/${roomId}/receipts?ids=${ids.join(",")}`
      )
      .then(setReadReceipts)
      .catch(() => {});
  }, [messages, roomId]);

  // Emit mark_read once per message from others. Without the ref guard,
  // every state change to `messages` (initial load of 30, every new arrival,
  // every edit) re-emitted for the entire list — each emit hits the DB via
  // readReceipt.upsert and broadcasts to the room. That was a 30x amplifier
  // on initial mount alone.
  const emittedReadIdsRef = useRef<Set<string>>(new Set());

  // Reset the dedupe set on room change so a fresh room starts fresh.
  useEffect(() => {
    emittedReadIdsRef.current = new Set();
  }, [roomId]);

  useEffect(() => {
    if (!socket || !user) return;
    for (const msg of messages) {
      if (msg.senderId === user.id) continue;
      if (emittedReadIdsRef.current.has(msg.id)) continue;
      socket.emit("mark_read", { messageId: msg.id, roomId });
      emittedReadIdsRef.current.add(msg.id);
    }
  }, [messages, socket, user, roomId]);

  // --- Search debounce (uses server-side API) ---
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    // Mirror the backend's 2-char minimum so we don't burn round-trips on
    // queries the API will reject. Clear stale results below the threshold.
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResultIds([]);
      setActiveSearchIndex(0);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await apiClient.get<Message[]>(
          `/rooms/${roomId}/messages/search?q=${encodeURIComponent(trimmed)}&limit=20`
        );
        // Merge any new messages (not yet in memory) into the message list
        setMessages((prev) => {
          const idSet = new Set(prev.map((m) => m.id));
          const newMsgs = results.filter((m) => !idSet.has(m.id));
          if (newMsgs.length === 0) return prev;
          return [...prev, ...newMsgs].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        setSearchResultIds(results.map((m) => m.id));
        setActiveSearchIndex(0);
        if (results.length > 0) {
          setScrollToMessageId(results[0].id);
          setTimeout(() => setScrollToMessageId(null), 100);
        }
      } catch (e) {
        console.error("Search failed:", e);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, roomId]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+/ — Toggle shortcuts modal
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((p) => !p);
        return;
      }

      // Escape — Close any open panel/modal
      if (e.key === "Escape") {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (forwardingMessage) { setForwardingMessage(null); return; }
        if (showInvite) { setShowInvite(false); return; }
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery("");
          setSearchResultIds([]);
          return;
        }
        if (showPinned) { setShowPinned(false); return; }
        if (showStarred) { setShowStarred(false); return; }
        if (showMembers) { setShowMembers(false); return; }
        if (activeThread) { setActiveThread(null); return; }
        if (profilePopover) { setProfilePopover(null); return; }
        return;
      }

      // Ctrl+Shift+M — Toggle members panel
      if (e.ctrlKey && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setShowMembers((p) => !p);
        setShowPinned(false);
        setShowStarred(false);
        setActiveThread(null);
        return;
      }

      // Ctrl+Shift+F — Toggle search bar
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setShowSearch((p) => {
          if (p) {
            setSearchQuery("");
            setSearchResultIds([]);
          }
          return !p;
        });
        return;
      }

      // Ctrl+Shift+S — Toggle starred panel
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setShowStarred((p) => !p);
        setShowPinned(false);
        setShowMembers(false);
        setActiveThread(null);
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showShortcuts, forwardingMessage, showInvite, showSearch, showPinned, showStarred, showMembers, activeThread, profilePopover]);

  // --- Handlers ---
  const handleSend = useCallback(
    (
      text: string,
      options?: { replyToId?: string; attachment?: Attachment }
    ) => {
      if (!user || !socket) return;
      socket.emit("send_message", {
        roomId,
        text,
        replyToId: options?.replyToId,
        attachment: options?.attachment,
      });
      setReplyingTo(null);
      // Sending implies the user has consumed prior context — fire mark-read
      // immediately and cancel the deferred timer so we don't double-fire.
      fireMarkRead();
    },
    [roomId, user, socket, fireMarkRead]
  );

  const handleEdit = useCallback(
    (messageId: string, newText: string) => {
      if (!socket) return;
      socket.emit("edit_message", { messageId, text: newText });
    },
    [socket]
  );

  const handleDelete = useCallback(
    (messageId: string) => {
      if (!socket) return;
      socket.emit("delete_message", { messageId });
    },
    [socket]
  );

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!socket) return;
      socket.emit("toggle_reaction", { messageId, emoji });
    },
    [socket]
  );

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const handlePin = useCallback(
    (messageId: string) => {
      apiClient
        .post<string[]>(`/rooms/${roomId}/messages/${messageId}/pin`)
        .then(setPinnedIds)
        .catch(console.error);
    },
    [roomId]
  );

  const handleJumpTo = useCallback((messageId: string) => {
    setScrollToMessageId(messageId);
    setTimeout(() => setScrollToMessageId(null), 100);
  }, []);

  const handleAvatarClick = useCallback(
    (e: React.MouseEvent, userId: string, userName: string) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const onlineUser = onlineUsers.find((u) => u.id === userId);
      setProfilePopover({
        userId,
        userName,
        userStatus: onlineUser?.status || "offline",
        anchorRect: rect,
      });
    },
    [onlineUsers]
  );

  // Search navigation
  const handleSearchNext = useCallback(() => {
    if (searchResultIds.length === 0) return;
    const next = (activeSearchIndex + 1) % searchResultIds.length;
    setActiveSearchIndex(next);
    setScrollToMessageId(searchResultIds[next]);
    setTimeout(() => setScrollToMessageId(null), 100);
  }, [activeSearchIndex, searchResultIds]);

  const handleSearchPrev = useCallback(() => {
    if (searchResultIds.length === 0) return;
    const prev =
      (activeSearchIndex - 1 + searchResultIds.length) %
      searchResultIds.length;
    setActiveSearchIndex(prev);
    setScrollToMessageId(searchResultIds[prev]);
    setTimeout(() => setScrollToMessageId(null), 100);
  }, [activeSearchIndex, searchResultIds]);

  // Thread
  const handleOpenThread = useCallback(
    (message: Message) => {
      setActiveThread(message);
      setShowMembers(false);
      setShowPinned(false);
    },
    []
  );

  const handleThreadReply = useCallback(
    (text: string, replyToId: string) => {
      handleSend(text, { replyToId });
    },
    [handleSend]
  );

  // Drag & drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) return;

    const reader = new FileReader();
    reader.onload = () => {
      setDragPreview({ file, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  }, []);

  // Star
  const handleToggleStar = useCallback(
    (messageId: string) => {
      apiClient
        .post<{ starred: boolean }>(`/messages/${messageId}/star`)
        .then(({ starred }) => {
          // Refresh star list from API to stay in sync
          apiClient
            .get<{ messageId: string }[]>(`/stars`)
            .then((entries) => setStarredIds(entries.map((e) => e.messageId)))
            .catch(() => {});
          showToast(starred ? "Message starred" : "Message unstarred", "info");
        })
        .catch(console.error);
    },
    [showToast]
  );

  // Forward — send a copy to the target room via socket
  const handleForward = useCallback((message: Message) => {
    setForwardingMessage(message);
  }, []);

  const handleForwardConfirm = useCallback(
    (targetRoomId: string, targetRoomName: string) => {
      if (!user || !forwardingMessage || !socket) return;
      socket.emit("send_message", {
        roomId: targetRoomId,
        text: forwardingMessage.text,
        attachment: forwardingMessage.attachment,
      });
      setForwardingMessage(null);
      showToast(`Message forwarded to #${targetRoomName}`, "success");
    },
    [user, forwardingMessage, socket, showToast]
  );

  // Load more (infinite scroll) — uses API with `before` cursor
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const oldest = messages[0];
    if (!oldest) {
      setIsLoadingMore(false);
      return;
    }

    try {
      const { messages: older, hasMore: moreExist } =
        await apiClient.get<PaginatedMessages>(
          `/rooms/${roomId}/messages?limit=15&before=${encodeURIComponent(oldest.createdAt)}`
        );
      // Dedupe before prepending. The scroll listener fires onLoadMore
      // whenever scrollTop drops under its threshold, including spurious
      // jitter from lazy-loaded GIF/image layout shifts; if it fires while
      // the API's older window overlaps with messages already in state,
      // a naive [...older, ...prev] produces duplicate React keys and the
      // map at MessageList warns. Mirrors the search-merge idSet pattern
      // earlier in this file.
      setMessages((prev) => {
        const idSet = new Set(prev.map((m) => m.id));
        const fresh = older.filter((m) => !idSet.has(m.id));
        if (fresh.length === 0) return prev;
        return [...fresh, ...prev];
      });
      setHasMore(moreExist);
    } catch (e) {
      console.error("Failed to load more messages:", e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, messages, roomId]);

  if (!user) return null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Chat column */}
      <div
        className="relative flex flex-1 flex-col"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Room header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">
            <span className="mr-1 text-text-secondary">{roomType === "DM" ? "@" : "#"}</span>
            {roomName}
          </h2>
          <div className="flex items-center gap-1">
            {/* Invite button (admins/mods only) */}
            {user && canInvite(roomId, user.id) && (
              <button
                onClick={() => setShowInvite(true)}
                className="rounded-md px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
                title="Invite"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </button>
            )}

            {/* Search button */}
            <button
              onClick={() => {
                setShowSearch((p) => !p);
                if (showSearch) {
                  setSearchQuery("");
                  setSearchResultIds([]);
                }
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                showSearch
                  ? "bg-active text-text-primary"
                  : "text-text-secondary hover:bg-hover hover:text-text-primary"
              }`}
            >
              <svg
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
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {/* Starred button */}
            <button
              onClick={() => {
                setShowStarred((p) => !p);
                setShowPinned(false);
                setShowMembers(false);
                setActiveThread(null);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                showStarred
                  ? "bg-active text-text-primary"
                  : "text-text-secondary hover:bg-hover hover:text-text-primary"
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={showStarred ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>

            {/* Pin button */}
            <button
              onClick={() => {
                setShowPinned((p) => !p);
                setShowMembers(false);
                setShowStarred(false);
                setActiveThread(null);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                showPinned
                  ? "bg-active text-text-primary"
                  : "text-text-secondary hover:bg-hover hover:text-text-primary"
              }`}
            >
              <span className="flex items-center gap-1">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 17v5" />
                  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5.76z" />
                </svg>
                {pinnedIds.length > 0 && pinnedIds.length}
              </span>
            </button>

            {/* Members button */}
            <button
              onClick={() => {
                setShowMembers((p) => !p);
                setShowPinned(false);
                setShowStarred(false);
                setActiveThread(null);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                showMembers
                  ? "bg-active text-text-primary"
                  : "text-text-secondary hover:bg-hover hover:text-text-primary"
              }`}
            >
              <span className="flex items-center gap-1">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {onlineUsers.length}
              </span>
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            resultCount={searchResultIds.length}
            activeIndex={activeSearchIndex}
            onPrev={handleSearchPrev}
            onNext={handleSearchNext}
            onClose={() => {
              setShowSearch(false);
              setSearchQuery("");
              setSearchResultIds([]);
            }}
          />
        )}

        {/* Messages */}
        <MessageList
          messages={messages}
          currentUserId={user.id}
          roomId={roomId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReply={handleReply}
          onPin={handlePin}
          onAvatarClick={handleAvatarClick}
          scrollToMessageId={scrollToMessageId}
          searchQuery={searchQuery || undefined}
          readReceipts={readReceipts}
          replyCountMap={replyCountMap}
          onOpenThread={handleOpenThread}
          onLoadMore={handleLoadMore}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          onForward={handleForward}
          onStar={handleToggleStar}
          starredIds={starredIds}
          pinnedIds={pinnedIds}
          onToggleReaction={handleToggleReaction}
          lastReadAt={lastReadSnapshot}
        />

        {/* Typing indicator */}
        <TypingIndicator names={typingNames} />

        {/* Input */}
        <MessageInput
          onSend={handleSend}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          roomId={roomId}
        />

        {/* Drag & drop overlay */}
        <DropZoneOverlay visible={isDragging} />

        {/* Image preview modal */}
        {dragPreview && (
          <ImagePreviewModal
            file={dragPreview.file}
            dataUrl={dragPreview.dataUrl}
            onSend={(attachment) => {
              handleSend(`Sent ${attachment.name}`, { attachment });
              setDragPreview(null);
            }}
            onCancel={() => setDragPreview(null)}
          />
        )}
      </div>

      {/* Members panel */}
      {showMembers && (
        <OnlineUsers users={onlineUsers} onAvatarClick={handleAvatarClick} />
      )}

      {/* Pinned messages panel */}
      {showPinned && (
        <PinnedMessagesPanel
          messages={messages}
          pinnedIds={pinnedIds}
          onUnpin={handlePin}
          onJumpTo={handleJumpTo}
          onClose={() => setShowPinned(false)}
        />
      )}

      {/* Starred messages panel */}
      {showStarred && (
        <StarredMessagesPanel
          onUnstar={handleToggleStar}
          onJumpTo={handleJumpTo}
          onClose={() => setShowStarred(false)}
        />
      )}

      {/* Thread panel */}
      {activeThread && (
        <ThreadPanel
          parentMessage={activeThread}
          allMessages={messages}
          currentUserId={user.id}
          onSendReply={handleThreadReply}
          onClose={() => setActiveThread(null)}
        />
      )}

      {/* Profile popover */}
      {profilePopover && (
        <UserProfilePopover
          userId={profilePopover.userId}
          userName={profilePopover.userName}
          userStatus={profilePopover.userStatus}
          anchorRect={profilePopover.anchorRect}
          onClose={() => setProfilePopover(null)}
        />
      )}

      {/* Invite link modal */}
      {showInvite && (
        <InviteLinkModal
          roomId={roomId}
          roomName={roomName}
          onClose={() => setShowInvite(false)}
        />
      )}

      {/* Forward message modal */}
      {forwardingMessage && (
        <ForwardMessageModal
          message={forwardingMessage}
          currentRoomId={roomId}
          onForward={handleForwardConfirm}
          onClose={() => setForwardingMessage(null)}
        />
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
