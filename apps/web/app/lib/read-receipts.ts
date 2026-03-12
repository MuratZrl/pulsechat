// Read receipt type — data comes from the backend via socket + REST API.

export interface ReadReceipt {
  userId: string;
  userName: string;
  readAt: string;
}
