'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../lib/api-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

// Singleton socket instance
let socketInstance: Socket | null = null;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    // Reuse existing connection or create new one
    if (!socketInstance || !socketInstance.connected) {
      socketInstance = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });
    }

    socketRef.current = socketInstance;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);

    if (socketInstance.connected) setIsConnected(true);

    return () => {
      socketInstance?.off('connect', onConnect);
      socketInstance?.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket: socketRef.current, isConnected };
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function getSocket(): Socket | null {
  return socketInstance;
}
