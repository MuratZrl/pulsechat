"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveInviteCode } from "../../../lib/room-invites";
import { getRooms } from "../../../lib/mock-data";

export default function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    const roomId = resolveInviteCode(code);
    if (roomId) {
      // Verify room exists
      const rooms = getRooms();
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        router.replace(`/chat/${roomId}`);
        return;
      }
    }
    setError(true);
  }, [code, router]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          Invalid Invite Link
        </h2>
        <p className="text-sm text-text-secondary">
          This invite link is expired or invalid.
        </p>
        <button
          onClick={() => router.push("/chat")}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Go to Chats
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-text-secondary">Joining room...</p>
    </div>
  );
}
