"use client";

import { useEffect } from "react";
import { useSocket } from "./useSocket";
import { useAuth } from "../contexts/auth-context";

interface MentionPayload {
  roomId: string;
  messageId: string;
  fromName: string;
  text: string;
}

export function usePushNotifications() {
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (!socket || !user) return;
    if (typeof Notification === "undefined") return;

    // Request permission on first call (non-blocking)
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const onMention = (payload: MentionPayload) => {
      if (Notification.permission !== "granted") return;
      // Only notify when the tab is not focused
      if (document.visibilityState === "visible") return;

      const n = new Notification(`${payload.fromName} mentioned you`, {
        body: payload.text.length > 100 ? payload.text.slice(0, 97) + "..." : payload.text,
        icon: "/favicon.ico",
        tag: `mention-${payload.messageId}`,
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };
    };

    socket.on("mention", onMention);
    return () => {
      socket.off("mention", onMention);
    };
  }, [socket, user]);
}
