"use client";

import { useEffect } from "react";

const BASE_TITLE = "Chats";

export function updateTabTitle(totalUnread: number) {
  if (typeof document === "undefined") return;
  document.title = totalUnread > 0 ? `(${totalUnread}) ${BASE_TITLE}` : BASE_TITLE;
}

export function useTabNotifications(totalUnread: number) {
  useEffect(() => {
    updateTabTitle(totalUnread);
    return () => {
      document.title = BASE_TITLE;
    };
  }, [totalUnread]);
}
