# PulseChat

PulseChat — a full-featured real-time chat application with WebSocket support, multi-room channels, direct messages, and rich messaging features.

---

## Screenshots

| General Chat | Engineering Channel |
|:---:|:---:|
| ![General Chat](docs/screenshots/Screenshot%20(17).png) | ![Engineering Channel](docs/screenshots/Screenshot%20(24).png) |

| DM with Pinned Messages | Settings Page |
|:---:|:---:|
| ![DM with Pinned Messages](docs/screenshots/Screenshot%20(18).png) | ![Settings Page](docs/screenshots/Screenshot%20(19).png) |

---

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────────┐
│   Next.js    │◄──────────────────►│   NestJS     │
│   Frontend   │     Socket.io      │   Backend    │
│  (port 3000) │                    │  (port 3001) │
└──────────────┘                    └──────┬───────┘
                                           │
                                    ┌──────┴───────┐
                                    │              │
                              ┌─────┴────┐  ┌─────┴────┐
                              │PostgreSQL│  │  Redis    │
                              │  (5432)  │  │  (6379)  │
                              └──────────┘  └──────────┘
```

```
pulsechat/
├── apps/
│   ├── api/                  # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/         # JWT auth (access + refresh tokens)
│   │   │   ├── chat/         # WebSocket gateway (Socket.io)
│   │   │   ├── messages/     # Message CRUD, replies, reactions
│   │   │   ├── rooms/        # Channels, DMs, invites
│   │   │   ├── users/        # User profiles
│   │   │   ├── pins-stars/   # Pin & star messages
│   │   │   ├── upload/       # File attachments (Multer)
│   │   │   └── prisma/       # Database service
│   │   └── prisma/           # Schema & migrations
│   └── web/                  # Next.js Frontend
│       └── app/
│           └── chat/         # Chat UI, rooms, modals
├── docker-compose.yml        # PostgreSQL + Redis + API + Web
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | NestJS 11, Socket.io 4.8, Passport JWT |
| Database | PostgreSQL 16, Prisma ORM |
| Cache/Pub-Sub | Redis 7 (@socket.io/redis-adapter) |
| File Upload | Multer |
| Auth | JWT (access + refresh tokens), bcrypt |
| Deploy | Docker Compose |

## Features

### Real-time Messaging
- WebSocket-based instant messaging (Socket.io)
- Typing indicators (start/stop)
- Online/offline user presence
- Read receipts with timestamps
- Unread message counts per room

### Channels & Direct Messages
- Create public channels
- Direct messages between users
- Join/leave rooms
- Shareable invite links with codes
- Member roles (admin, member)

### Rich Messaging
- Text messages with create, edit, delete
- Reply to messages (threads)
- Emoji reactions per message
- Message forwarding between rooms
- Pin important messages
- Star messages for quick access
- Mentions with notification tracking

### File Sharing
- Upload file attachments to messages
- Multer-based storage with volume persistence
- Static file serving

### User Management
- JWT authentication (access + refresh tokens)
- User profiles (name, bio, avatar)
- Avatar picker
- Auto-join default rooms on registration

### UI Features
- Emoji picker
- GIF picker
- Keyboard shortcuts
- Responsive chat layout

## Database Schema

```
User ──< RoomMember >── Room
  │                       │
  │── Message ────────────│
  │── MessageReaction     │── RoomInvite
  │── Mention             │── Pin
  │── Star                │── ReadReceipt
```

**10 models:** User, Room, RoomMember, RoomInvite, Message, MessageReaction, Mention, Pin, Star, ReadReceipt

## Local Setup

### Prerequisites
- Docker & Docker Compose

### Quick Start (Docker)

```bash
git clone https://github.com/MuratZrl/pulsechat.git
cd pulsechat
docker compose up
```

- Frontend: http://localhost:3000
- API: http://localhost:3001

### Manual Setup

```bash
# Install dependencies
npm install
cd apps/api && npm install
cd ../web && npm install

# Start PostgreSQL + Redis
docker compose up postgres redis -d

# Run database migrations
cd apps/api
npx prisma db push

# Start API
npm run start:dev

# Start frontend (new terminal)
cd apps/web
npm run dev
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in (returns JWT) |
| POST | `/api/auth/refresh` | Refresh access token |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms` | Create channel |
| GET | `/api/rooms` | List user's rooms |
| POST | `/api/rooms/:id/join` | Join room |
| POST | `/api/rooms/:id/leave` | Leave room |
| POST | `/api/rooms/:id/invite` | Create invite link |
| GET | `/api/rooms/join/:code` | Join via invite code |
| GET | `/api/rooms/dm/:userId` | Get/create DM |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/:roomId` | Get messages (paginated) |
| POST | `/api/messages` | Send message |
| PATCH | `/api/messages/:id` | Edit message |
| DELETE | `/api/messages/:id` | Delete message |
| POST | `/api/messages/:id/react` | Add reaction |
| POST | `/api/messages/:id/forward` | Forward message |

### WebSocket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `send_message` | Client → Server | Send new message |
| `new_message` | Server → Client | Receive message |
| `typing_start` | Client → Server | Start typing |
| `typing_stop` | Client → Server | Stop typing |
| `user_typing` | Server → Client | User is typing |
| `message_edited` | Server → Client | Message was edited |
| `message_deleted` | Server → Client | Message was deleted |
| `reaction_updated` | Server → Client | Reaction changed |
| `read_receipt` | Bidirectional | Mark messages read |

## License

MIT
