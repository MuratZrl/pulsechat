"use client";

import { useState } from "react";

export interface ReadReceipt {
  userId: string;
  userName: string;
  readAt: string;
}

interface ReadReceiptIndicatorProps {
  receipts: ReadReceipt[];
}

export function ReadReceiptIndicator({ receipts }: ReadReceiptIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const isRead = receipts.length > 0;

  return (
    <span
      className="relative ml-1 inline-flex cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {isRead ? (
        // Double blue check
        <svg width="14" height="10" viewBox="0 0 20 12" fill="none">
          <polyline
            points="1 6 5 10 13 2"
            stroke="#60a5fa"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <polyline
            points="5 6 9 10 17 2"
            stroke="#60a5fa"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ) : (
        // Single grey check
        <svg width="12" height="10" viewBox="0 0 14 12" fill="none">
          <polyline
            points="1 6 5 10 13 2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.5"
          />
        </svg>
      )}

      {/* Tooltip */}
      {showTooltip && receipts.length > 0 && (
        <span className="absolute bottom-full right-0 z-50 mb-1 w-max max-w-48 rounded bg-zinc-900 px-2 py-1 text-[10px] text-white shadow-lg">
          Read by{" "}
          {receipts.map((r, i) => {
            const time = new Date(r.readAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <span key={r.userId}>
                {r.userName} at {time}
                {i < receipts.length - 1 ? ", " : ""}
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}
