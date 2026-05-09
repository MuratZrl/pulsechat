import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';

type ReactionMap = Record<string, string[]>; // emoji -> userIds

// Strict GIPHY URL shape — matches what the picker's `original.url` returns
// from /v1/gifs/trending and /v1/gifs/search:
//   https://media{N}.giphy.com/media/[v1.{base64}/]{id}/giphy.gif?{query}
//   https://i.giphy.com/media/{id}/giphy.gif
// The trailing-slash anchor on the host (`\.giphy\.com\/`) closes the
// lookalike-domain hole (`media.giphy.com.evil.com/...`).
const GIPHY_URL_PATTERN =
  /^https:\/\/(media\d*|i)\.giphy\.com\/media\/(v1\.[A-Za-z0-9_-]+\/)?[A-Za-z0-9]+\/giphy\.gif(\?[^#]*)?$/;

const ATTACHMENT_RATE_LIMIT = 10;
const ATTACHMENT_RATE_WINDOW_SECONDS = 60;

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  private buildReactionMap(
    reactions: { emoji: string; userId: string }[],
  ): ReactionMap {
    const map: ReactionMap = {};
    for (const r of reactions) {
      if (!map[r.emoji]) map[r.emoji] = [];
      map[r.emoji].push(r.userId);
    }
    return map;
  }

  private formatMessage(msg: {
    id: string;
    roomId: string;
    senderId: string;
    text: string;
    createdAt: Date;
    editedAt: Date | null;
    isDeleted: boolean;
    replyToId: string | null;
    attachment: unknown;
    forwarded: unknown;
    sender: { id: string; name: string };
    reactions?: { emoji: string; userId: string }[];
    mentions?: { userId: string; user: { name: string } }[];
    replyTo?: {
      id: string;
      text: string;
      isDeleted: boolean;
      attachment?: unknown;
      mentions?: { userId: string; user: { name: string } }[];
      sender: { name: string };
    } | null;
  }) {
    return {
      id: msg.id,
      roomId: msg.roomId,
      senderId: msg.senderId,
      senderName: msg.sender.name,
      text: msg.isDeleted ? '' : msg.text,
      createdAt: msg.createdAt.toISOString(),
      editedAt: msg.editedAt?.toISOString(),
      isDeleted: msg.isDeleted,
      replyToId: msg.replyToId ?? undefined,
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            text: msg.replyTo.isDeleted ? '' : msg.replyTo.text,
            // Strip the attachment on tombstones too — a deleted parent should
            // render as "This message was deleted" in the reply preview, not
            // expose a still-resolvable image/file URL after deletion.
            attachment: msg.replyTo.isDeleted
              ? undefined
              : (msg.replyTo.attachment ?? undefined),
            // Strip mentions on tombstones for the same reason — no need to
            // surface "this deleted message tagged you" via a stale pill.
            mentions: msg.replyTo.isDeleted
              ? []
              : (msg.replyTo.mentions?.map((m) => ({
                  userId: m.userId,
                  userName: m.user.name,
                })) ?? []),
            senderName: msg.replyTo.sender.name,
          }
        : undefined,
      attachment: msg.attachment ?? undefined,
      forwarded: msg.forwarded ?? undefined,
      reactions: this.buildReactionMap(msg.reactions ?? []),
      // Resolved mentions for client-side pill rendering. Empty array on
      // deleted messages — the body text is already cleared above.
      mentions: msg.isDeleted
        ? []
        : (msg.mentions?.map((m) => ({
            userId: m.userId,
            userName: m.user.name,
          })) ?? []),
    };
  }

  private readonly messageInclude = {
    sender: { select: { id: true, name: true } },
    reactions: { select: { emoji: true, userId: true } },
    // Resolved mentions for the client renderer — already in DB from the
    // sender path's regex+lookup, but the API was previously stripping them
    // from the response. With these surfaced the FormattedText helper can
    // render @name as a pill.
    mentions: {
      select: { userId: true, user: { select: { name: true } } },
    },
    replyTo: {
      select: {
        id: true,
        text: true,
        isDeleted: true,
        // attachment surfaces in the ReplyQuote so empty-body sends (new
        // GIFs/voice/image/file) and legacy "[GIF] {title}" captions can fall
        // through to a meaningful preview instead of a deleted placeholder.
        attachment: true,
        // mentions surface here too so reply quotes get the same pill render
        // as the parent body — Discord-parity, less visual inconsistency.
        mentions: {
          select: { userId: true, user: { select: { name: true } } },
        },
        sender: { select: { name: true } },
      },
    },
  };

  async getMessages(
    roomId: string,
    userId: string,
    limit = 30,
    before?: string,
  ) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    const take = limit + 1;
    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: this.messageInclude,
    });

    const hasMore = messages.length > limit;
    const result = messages.slice(0, limit).reverse();

    return {
      messages: result.map((m) => this.formatMessage(m)),
      hasMore,
    };
  }

  async sendMessage(
    roomId: string,
    userId: string,
    dto: CreateMessageDto,
    senderName: string,
  ) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    // Attachment URL whitelist. R2 stays as a prefix match (we mint those
    // keys ourselves so any URL under R2_PUBLIC_URL is by-construction trusted).
    // GIPHY URLs use a strict regex instead of a domain prefix so an attacker
    // can't smuggle arbitrary paths under media.giphy.com — only the exact
    // /media/[v1.{base64}/]{id}/giphy.gif shape the picker submits is allowed.
    if (dto.attachment?.url) {
      const url = dto.attachment.url;
      const r2PublicUrl = this.config.getOrThrow<string>('R2_PUBLIC_URL');
      const isR2 = url.startsWith(`${r2PublicUrl}/`);
      const isGiphy = GIPHY_URL_PATTERN.test(url);
      if (!isR2 && !isGiphy) {
        throw new BadRequestException('Attachment URL is not from an allowed source');
      }
    }

    // Per-user attachment rate limit (10/min). The general 30/min message
    // limit (chat.gateway.ts for WS, the global ThrottlerGuard for HTTP) is
    // too generous for media payloads — every recipient's browser fetches
    // the GIF when the message renders, so a single sender can pile downstream
    // bandwidth on every member of the room.
    if (dto.attachment) {
      await this.assertAttachmentRateLimit(userId);
    }

    // Cross-room reply check — without this, a member of R1 could quote a
    // private R2 message and the reply preview would render R2 content in R1.
    if (dto.replyToId) {
      const replyTarget = await this.prisma.message.findUnique({
        where: { id: dto.replyToId },
        select: { roomId: true, isDeleted: true },
      });
      if (!replyTarget) throw new NotFoundException('Reply target not found');
      if (replyTarget.roomId !== roomId) {
        throw new BadRequestException('Cannot reply to a message from another room');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId: userId,
        text: dto.text,
        replyToId: dto.replyToId ?? null,
        attachment: dto.attachment ? (dto.attachment as object) : undefined,
        forwarded: dto.forwarded ? (dto.forwarded as object) : undefined,
      },
      include: this.messageInclude,
    });

    // Parse @mentions and store them.
    //
    // Capture the longest `@<word>(<space><word>)*` sequence at each @, then
    // resolve to a user via longest-prefix lookup. The capture often extends
    // past the actual name (e.g. "@Test User hi!" → "Test User hi"); we try
    // "Test User hi", "Test User", "Test" and take the longest that maps to
    // a real room member.
    //
    // The previous pattern `\w[\w ]*?\w|\w+` had a lazy quantifier that
    // collapsed every @-name to its first two characters — "@Test User"
    // captured as "Te", "@alice" as "al" — so no @-mention ever resolved
    // and the Mention table stayed empty regardless of body content.
    const mentionPattern = /@(\w+(?:\s\w+)*)/g;
    const matches = [...dto.text.matchAll(mentionPattern)];

    if (matches.length > 0) {
      const candidatesByMatch: string[][] = matches.map((m) => {
        const words = m[1].split(/\s+/);
        return Array.from({ length: words.length }, (_, i) =>
          words.slice(0, words.length - i).join(' '),
        );
      });
      const allCandidates = [
        ...new Set(
          candidatesByMatch.flat().map((c) => c.toLowerCase()),
        ),
      ];

      // No `id: { not: userId }` exclusion: self-tags need a Mention row
      // so the renderer can paint a pill on the author's @-name for every
      // reader (including the author themselves, in self-mention amber).
      // Notification suppression for self-tags is handled at two later
      // gates: the row is inserted with `read: true` below (so the unread
      // mention count badge doesn't inflate), and the gateway's `mention`
      // socket emit skips the author's own per-user room.
      const users = await this.prisma.user.findMany({
        where: {
          name: { in: allCandidates, mode: 'insensitive' },
          rooms: { some: { roomId } },
        },
        select: { id: true, name: true },
      });

      if (users.length > 0) {
        const userByLowerName = new Map(
          users.map((u) => [u.name.toLowerCase(), u] as const),
        );
        const matchedUserIds = new Set<string>();
        for (const candidates of candidatesByMatch) {
          for (const candidate of candidates) {
            const user = userByLowerName.get(candidate.toLowerCase());
            if (user) {
              matchedUserIds.add(user.id);
              break;
            }
          }
        }

        if (matchedUserIds.size > 0) {
          await this.prisma.mention.createMany({
            data: [...matchedUserIds].map((uid) => ({
              messageId: message.id,
              userId: uid,
              // Self-mentions land pre-read so they don't inflate the
              // author's unread mention count in the sidebar. Mentions of
              // others stay `read: false` (the schema default) until the
              // recipient opens the room and POST /rooms/:id/read sweeps
              // them via mention.updateMany.
              read: uid === userId,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    return this.formatMessage(message);
  }

  async editMessage(messageId: string, userId: string, dto: EditMessageDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId)
      throw new ForbiddenException('Cannot edit others messages');
    if (message.isDeleted) throw new ForbiddenException('Message is deleted');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { text: dto.text, editedAt: new Date() },
      include: this.messageInclude,
    });

    return this.formatMessage(updated);
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        room: { include: { members: { where: { userId } } } },
      },
    });
    if (!message) throw new NotFoundException('Message not found');

    const member = message.room.members[0];
    const isOwner = message.senderId === userId;
    const canDelete =
      isOwner || member?.role === 'admin' || member?.role === 'moderator';
    if (!canDelete) throw new ForbiddenException('Cannot delete this message');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, text: '' },
      include: this.messageInclude,
    });

    return this.formatMessage(updated);
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { roomId: true },
    });
    if (!message) throw new NotFoundException('Message not found');

    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId: message.roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    // Atomic toggle: try to insert; if the unique constraint trips the row
    // already exists, so delete it instead. The previous find-then-create/
    // delete was racy — a fast double-click could observe `existing === null`
    // twice and produce a 500 from the duplicate insert.
    try {
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        await this.prisma.messageReaction.deleteMany({
          where: { messageId, userId, emoji },
        });
      } else {
        throw err;
      }
    }

    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });

    return {
      messageId,
      roomId: message.roomId,
      reactions: this.buildReactionMap(reactions),
    };
  }

  /**
   * Sliding-window attachment rate limit, separate from the general message
   * counter. Increments a Redis counter keyed by user; sets the TTL on first
   * hit so the window slides cleanly.
   */
  private async assertAttachmentRateLimit(userId: string): Promise<void> {
    const key = `rl:msg-attachment:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ATTACHMENT_RATE_WINDOW_SECONDS);
    }
    if (count > ATTACHMENT_RATE_LIMIT) {
      throw new BadRequestException('Attachment rate limit exceeded — slow down');
    }
  }

  async getUnreadMentions(userId: string) {
    return this.prisma.mention.findMany({
      where: { userId, read: false },
      include: {
        message: {
          select: { id: true, roomId: true, text: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markMentionsRead(userId: string, roomId: string) {
    await this.prisma.mention.updateMany({
      where: { userId, read: false, message: { roomId } },
      data: { read: true },
    });
  }

  async getReceipts(
    roomId: string,
    userId: string,
    messageIds: string[],
  ): Promise<Record<string, { userId: string; userName: string; readAt: string }[]>> {
    // Cap up front so a huge crafted list can't blow up the IN clause before
    // the membership check runs.
    if (messageIds.length > 200) {
      throw new BadRequestException('Too many message ids');
    }

    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    if (!messageIds.length) return {};

    // Second authorization layer: even a member of R1 can pass message ids
    // that belong to R2. The `message: { roomId }` filter silently drops
    // those instead of leaking who-read-what across rooms.
    const receipts = await this.prisma.readReceipt.findMany({
      where: { messageId: { in: messageIds }, message: { roomId } },
      include: { user: { select: { id: true, name: true } } },
    });

    const result: Record<string, { userId: string; userName: string; readAt: string }[]> = {};
    for (const r of receipts) {
      if (!result[r.messageId]) result[r.messageId] = [];
      result[r.messageId].push({
        userId: r.userId,
        userName: r.user.name,
        readAt: r.readAt.toISOString(),
      });
    }
    return result;
  }

  async searchMessages(roomId: string, userId: string, query: string, limit = 20) {
    const member = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this room');

    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        isDeleted: false,
        text: { contains: query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: this.messageInclude,
    });

    return messages.map((m) => this.formatMessage(m));
  }
}
