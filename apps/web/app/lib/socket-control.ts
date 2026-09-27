import type { Socket } from "socket.io-client";

// Holds the tab's single shared socket (created in useSocket). Kept as a
// standalone module so non-hook code can reach the instance without
// importing the hook module.

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
