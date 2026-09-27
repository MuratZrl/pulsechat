'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../lib/api-client';
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
    socket = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    setSocketInstance(socket);
  }
  return socket;
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;

    const shared = ensureSocket();
    setSocket(shared);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    shared.on('connect', onConnect);
    shared.on('disconnect', onDisconnect);

    setIsConnected(shared.connected);

    return () => {
      shared.off('connect', onConnect);
      shared.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket, isConnected };
}

export const disconnectSocket = disconnectSocketCtrl;
export const getSocket = getSocketCtrl;
