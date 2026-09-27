"use client";

import { useEffect, useState } from "react";
import { Attachment } from "../types";
import { apiClient } from "./api-client";

// Private attachments (those with a `key`) aren't publicly readable. The API
// checks room membership and returns a signed URL that expires after a few
// minutes; cache it per message and fetch a fresh one shortly before expiry.
const REFRESH_MARGIN_MS = 30_000;
const cache = new Map<string, { url: string; expiresAt: number }>();
const pending = new Map<string, Promise<string | null>>();

export function getAttachmentUrl(messageId: string): Promise<string | null> {
  const hit = cache.get(messageId);
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return Promise.resolve(hit.url);
  }

  let request = pending.get(messageId);
  if (!request) {
    request = apiClient
      .get<{ url: string; expiresIn: number }>(`/messages/${messageId}/attachment`)
      .then(({ url, expiresIn }) => {
        cache.set(messageId, { url, expiresAt: Date.now() + expiresIn * 1000 });
        return url;
      })
      .catch(() => null)
      .finally(() => pending.delete(messageId));
    pending.set(messageId, request);
  }
  return request;
}

/**
 * Displayable URL for an attachment: its public `url` when it has one,
 * otherwise a signed URL for its private `key` (null until it arrives).
 */
export function useAttachmentUrl(
  messageId: string | undefined,
  attachment: Attachment,
): string | null {
  const [signed, setSigned] = useState<string | null>(null);
  const needsSigning = !attachment.url && !!attachment.key && !!messageId;

  useEffect(() => {
    if (!needsSigning || !messageId) return;
    let cancelled = false;
    getAttachmentUrl(messageId).then((url) => {
      if (!cancelled) setSigned(url);
    });
    return () => {
      cancelled = true;
    };
  }, [needsSigning, messageId]);

  return attachment.url ?? signed;
}
