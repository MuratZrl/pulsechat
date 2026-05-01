import type { Socket } from "socket.io-client";

// Standalone module so api-client (which doesn't otherwise know about the
// socket) can call disconnectSocket without importing from useSocket — that
// would close an api-client → useSocket → api-client import cycle.

let socketInstance: Socket | null = null;

export function setSocketInstance(s: Socket | null) {
  socketInstance = s;
}

export function getSocket(): Socket | null {
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
