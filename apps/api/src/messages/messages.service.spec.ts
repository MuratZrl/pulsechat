import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const now = new Date('2025-06-01');

  /** Helper to build a raw message object matching the shape Prisma returns. */
  function makeMessage(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'm1',
      roomId: 'r1',
      senderId: 'u1',
      text: 'hello',
      createdAt: now,
      editedAt: null,
      isDeleted: false,
      replyToId: null,
      attachment: null,
      forwarded: null,
      sender: { id: 'u1', name: 'Alice', avatarUrl: null, avatarPreset: null },
      reactions: [],
      replyTo: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      roomMember: {
        findUnique: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      messageReaction: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      mention: {
        createMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('https://test-r2.example'),
          },
        },
        {
          provide: RedisService,
          useValue: {
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  // ── sendMessage ─────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('should create a message and return formatted result', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ userId: 'u1', roomId: 'r1' });
      const msg = makeMessage();
      prisma.message.create.mockResolvedValue(msg);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.sendMessage('r1', 'u1', { text: 'hello' }, 'Alice');

      expect(result.id).toBe('m1');
      expect(result.text).toBe('hello');
      expect(result.senderName).toBe('Alice');
      expect(result.reactions).toEqual({});
      expect(prisma.message.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('r1', 'u1', { text: 'hello' }, 'Alice'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── editMessage ─────────────────────────────────────────────────────────────

  describe('editMessage', () => {
    it('should edit the message and return formatted result', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'm1',
        senderId: 'u1',
        isDeleted: false,
      });
      const updated = makeMessage({ text: 'edited', editedAt: now });
      prisma.message.update.mockResolvedValue(updated);

      const result = await service.editMessage('m1', 'u1', { text: 'edited' });

      expect(result.text).toBe('edited');
      expect(result.editedAt).toBe(now.toISOString());
    });

    it('should throw NotFoundException when message does not exist', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      await expect(service.editMessage('bad', 'u1', { text: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not the sender', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'm1',
        senderId: 'u2',
        isDeleted: false,
      });

      await expect(service.editMessage('m1', 'u1', { text: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── deleteMessage ───────────────────────────────────────────────────────────

  describe('deleteMessage', () => {
    it('should soft-delete when user is the owner', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'm1',
        senderId: 'u1',
        room: { members: [{ userId: 'u1', role: 'member' }] },
      });
      const deleted = makeMessage({ isDeleted: true, text: '' });
      prisma.message.update.mockResolvedValue(deleted);

      const result = await service.deleteMessage('m1', 'u1');

      expect(result.isDeleted).toBe(true);
      expect(result.text).toBe('');
    });

    it('should throw NotFoundException when message does not exist', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      await expect(service.deleteMessage('bad', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not owner and not admin/moderator', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'm1',
        senderId: 'u2',
        room: { members: [{ userId: 'u1', role: 'member' }] },
      });

      await expect(service.deleteMessage('m1', 'u1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── toggleReaction ──────────────────────────────────────────────────────────

  describe('toggleReaction', () => {
    it('should add a reaction when none exists', async () => {
      prisma.message.findUnique.mockResolvedValue({ roomId: 'r1' });
      prisma.roomMember.findUnique.mockResolvedValue({ userId: 'u1' });
      prisma.messageReaction.create.mockResolvedValue({});
      prisma.messageReaction.findMany.mockResolvedValue([
        { emoji: '👍', userId: 'u1' },
      ]);

      const result = await service.toggleReaction('m1', 'u1', '👍');

      expect(result.reactions).toEqual({ '👍': ['u1'] });
      expect(prisma.messageReaction.create).toHaveBeenCalled();
      expect(prisma.messageReaction.deleteMany).not.toHaveBeenCalled();
    });

    it('should remove a reaction when create raises P2002 (already exists)', async () => {
      prisma.message.findUnique.mockResolvedValue({ roomId: 'r1' });
      prisma.roomMember.findUnique.mockResolvedValue({ userId: 'u1' });
      prisma.messageReaction.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      prisma.messageReaction.deleteMany.mockResolvedValue({ count: 1 });
      prisma.messageReaction.findMany.mockResolvedValue([]);

      const result = await service.toggleReaction('m1', 'u1', '👍');

      expect(result.reactions).toEqual({});
      expect(prisma.messageReaction.deleteMany).toHaveBeenCalledWith({
        where: { messageId: 'm1', userId: 'u1', emoji: '👍' },
      });
    });

    it('should rethrow non-P2002 errors from create', async () => {
      prisma.message.findUnique.mockResolvedValue({ roomId: 'r1' });
      prisma.roomMember.findUnique.mockResolvedValue({ userId: 'u1' });
      const boom = new Error('connection lost');
      prisma.messageReaction.create.mockRejectedValue(boom);

      await expect(service.toggleReaction('m1', 'u1', '👍')).rejects.toBe(boom);
      expect(prisma.messageReaction.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when message does not exist', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      await expect(service.toggleReaction('bad', 'u1', '👍')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── searchMessages ──────────────────────────────────────────────────────────

  describe('searchMessages', () => {
    it('should return formatted messages matching query', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ userId: 'u1' });
      prisma.message.findMany.mockResolvedValue([makeMessage()]);

      const result = await service.searchMessages('r1', 'u1', 'hello');

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('hello');
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.searchMessages('r1', 'u1', 'hello')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
