'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  getAccessToken,
  refreshAccessToken,
  expireSession,
} from '../lib/api-client';
import {
  disconnectSocket as disconnectSocketCtrl,
  getSocket as getSocketCtrl,
  setSocketInstance,
} from '../lib/socket-control';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

// One socket per tab, shared by every useSocket() caller. Creating it only
// when none exists (instead of whenever the current one isn't connected yet)
// stops the layout, page, room list and input from each opening their own
// connection on mount. `auth` is a callback so every (re)connect handshake
// reads the current access token — a token refresh no longer has to tear the
// socket down, and the gateway re-joins every member room on each connect.
function ensureSocket(): Socket {
  let socket = getSocketCtrl();
  if (!socket) {
    const created = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
      // WebSocket first; fall back to long-polling when the upgrade fails
      // (proxies that drop or 502 WebSocket handshakes).
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });

    // A middleware rejection (auth failure) leaves the socket inactive — no
    // automatic retry. After an API restart the handshake re-sends the token
    // the tab already had, which may have expired in the meantime: refresh it
    // and reconnect. If the refresh itself fails the session is over.
    created.on('connect_error', (err: Error & { data?: { code?: string } }) => {
      if (created.active || err.data?.code !== 'TOKEN_EXPIRED') return;
      void refreshAccessToken().then((refreshed) => {
        if (refreshed) created.connect();
        else expireSession();
      });
    });

    setSocketInstance(created);
    socket = created;
  }
  return socket;
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;

    const shared = ensureSocket();
    setSocket(shared);

    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
    };
    const onDisconnect = () => setIsConnected(false);
    // Emitted by the manager before each automatic retry, so the flag only
    // covers a dropped connection — not the initial connect on page load.
    const onReconnectAttempt = () => setIsReconnecting(true);

    shared.on('connect', onConnect);
    shared.on('disconnect', onDisconnect);
    shared.io.on('reconnect_attempt', onReconnectAttempt);

    setIsConnected(shared.connected);

    return () => {
      shared.off('connect', onConnect);
      shared.off('disconnect', onDisconnect);
      shared.io.off('reconnect_attempt', onReconnectAttempt);
    };
  }, []);

  return { socket, isConnected, isReconnecting };
}

export const disconnectSocket = disconnectSocketCtrl;
export const getSocket = getSocketCtrl;
