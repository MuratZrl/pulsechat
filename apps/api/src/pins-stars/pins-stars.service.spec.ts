import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinsStarsService } from './pins-stars.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PinsStarsService', () => {
  let service: PinsStarsService;
  let prisma: jest.Mocked<Record<string, any>>;

  beforeEach(async () => {
    prisma = {
      pin: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      star: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      message: {
        findUnique: jest.fn(),
      },
      roomMember: {
        findUnique: jest.fn(),
      },
    };
    // Default: every test passes the membership guard. Individual tests can
    // override this to simulate a non-member.
    prisma.roomMember.findUnique.mockResolvedValue({
      userId: 'user-1',
      roomId: 'room-1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PinsStarsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PinsStarsService>(PinsStarsService);
  });

  // ── togglePin ────────────────────────────────────────────────────────────────

  describe('togglePin', () => {
    const roomId = 'room-1';
    const messageId = 'msg-1';
    const userId = 'user-1';

    it('should create a pin when none exists and return updated pin ids', async () => {
      prisma.pin.create.mockResolvedValue({ id: 'pin-1', messageId, userId, roomId });
      prisma.pin.findMany.mockResolvedValue([
        { messageId: 'msg-1' },
        { messageId: 'msg-2' },
      ]);

      const result = await service.togglePin(roomId, messageId, userId);

      expect(prisma.pin.create).toHaveBeenCalledWith({
        data: { messageId, userId, roomId },
      });
      expect(prisma.pin.deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual(['msg-1', 'msg-2']);
    });

    it('should delete the pin when create raises P2002 (already exists)', async () => {
      prisma.pin.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      prisma.pin.deleteMany.mockResolvedValue({ count: 1 });
      prisma.pin.findMany.mockResolvedValue([]);

      const result = await service.togglePin(roomId, messageId, userId);

      expect(prisma.pin.deleteMany).toHaveBeenCalledWith({
        where: { messageId, userId },
      });
      expect(result).toEqual([]);
    });

    it('should rethrow non-P2002 errors from create', async () => {
      const boom = new Error('connection lost');
      prisma.pin.create.mockRejectedValue(boom);

      await expect(service.togglePin(roomId, messageId, userId)).rejects.toBe(boom);
      expect(prisma.pin.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when the user is not a room member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(
        service.togglePin(roomId, messageId, userId),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.pin.create).not.toHaveBeenCalled();
      expect(prisma.pin.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ── getPinnedIds ─────────────────────────────────────────────────────────────

  describe('getPinnedIds', () => {
    it('should return an array of pinned message ids for the room', async () => {
      prisma.pin.findMany.mockResolvedValue([
        { messageId: 'msg-1' },
        { messageId: 'msg-2' },
        { messageId: 'msg-3' },
      ]);

      const result = await service.getPinnedIds('room-1', 'user-1');

      expect(prisma.pin.findMany).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        select: { messageId: true },
      });
      expect(result).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });

    it('should throw ForbiddenException when the user is not a room member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.getPinnedIds('room-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.pin.findMany).not.toHaveBeenCalled();
    });
  });

  // ── toggleStar ───────────────────────────────────────────────────────────────

  describe('toggleStar', () => {
    const messageId = 'msg-1';
    const userId = 'user-1';
    const roomId = 'room-1';

    it('should create a star when none exists and return true', async () => {
      prisma.star.create.mockResolvedValue({ id: 'star-1', messageId, userId, roomId });

      const result = await service.toggleStar(messageId, userId, roomId);

      expect(prisma.star.create).toHaveBeenCalledWith({
        data: { messageId, userId, roomId },
      });
      expect(prisma.star.deleteMany).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should delete the star when create raises P2002 and return false', async () => {
      prisma.star.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      prisma.star.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.toggleStar(messageId, userId, roomId);

      expect(prisma.star.deleteMany).toHaveBeenCalledWith({
        where: { messageId, userId },
      });
      expect(result).toBe(false);
    });

    it('should rethrow non-P2002 errors from create', async () => {
      const boom = new Error('connection lost');
      prisma.star.create.mockRejectedValue(boom);

      await expect(service.toggleStar(messageId, userId, roomId)).rejects.toBe(boom);
      expect(prisma.star.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ── getStarredIds ────────────────────────────────────────────────────────────

  describe('getStarredIds', () => {
    it('should return an array of starred message ids for the user', async () => {
      prisma.star.findMany.mockResolvedValue([
        { messageId: 'msg-10' },
        { messageId: 'msg-20' },
      ]);

      const result = await service.getStarredIds('user-1');

      expect(prisma.star.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { messageId: true },
      });
      expect(result).toEqual(['msg-10', 'msg-20']);
    });
  });

  // ── getStarredEntries ────────────────────────────────────────────────────────

  describe('getStarredEntries', () => {
    it('should return mapped starred entries', async () => {
      const now = new Date('2025-01-15T12:00:00Z');
      prisma.star.findMany.mockResolvedValue([
        {
          messageId: 'msg-1',
          roomId: 'room-1',
          createdAt: now,
          message: {
            id: 'msg-1',
            text: 'Hello world',
            isDeleted: false,
            senderId: 'user-2',
            sender: { name: 'Alice' },
          },
          room: { id: 'room-1', name: 'General', type: 'channel' },
        },
      ]);

      const result = await service.getStarredEntries('user-1');

      expect(prisma.star.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          message: {
            select: {
              id: true,
              text: true,
              isDeleted: true,
              senderId: true,
              sender: { select: { name: true } },
            },
          },
          room: { select: { id: true, name: true, type: true } },
        },
      });

      expect(result).toEqual([
        {
          messageId: 'msg-1',
          roomId: 'room-1',
          roomName: 'General',
          starredAt: now.toISOString(),
          message: {
            id: 'msg-1',
            text: 'Hello world',
            senderName: 'Alice',
          },
        },
      ]);
    });

    it('should filter out deleted messages', async () => {
      const now = new Date('2025-01-15T12:00:00Z');
      prisma.star.findMany.mockResolvedValue([
        {
          messageId: 'msg-1',
          roomId: 'room-1',
          createdAt: now,
          message: {
            id: 'msg-1',
            text: '',
            isDeleted: true,
            senderId: 'user-2',
            sender: { name: 'Alice' },
          },
          room: { id: 'room-1', name: 'General', type: 'channel' },
        },
        {
          messageId: 'msg-2',
          roomId: 'room-1',
          createdAt: now,
          message: {
            id: 'msg-2',
            text: 'Visible message',
            isDeleted: false,
            senderId: 'user-3',
            sender: { name: 'Bob' },
          },
          room: { id: 'room-1', name: 'General', type: 'channel' },
        },
      ]);

      const result = await service.getStarredEntries('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].messageId).toBe('msg-2');
    });
  });

  // ── toggleStarLookup ─────────────────────────────────────────────────────────

  describe('toggleStarLookup', () => {
    it('should look up the message room and delegate to toggleStar', async () => {
      prisma.message.findUnique.mockResolvedValue({ roomId: 'room-1' });
      // toggleStar internals: no existing star -> create succeeds.
      prisma.star.create.mockResolvedValue({
        id: 'star-1',
        messageId: 'msg-1',
        userId: 'user-1',
        roomId: 'room-1',
      });

      const result = await service.toggleStarLookup('msg-1', 'user-1');

      expect(prisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        select: { roomId: true },
      });
      expect(result).toBe(true);
    });

    it('should return false when the message is not found', async () => {
      prisma.message.findUnique.mockResolvedValue(null);

      const result = await service.toggleStarLookup('nonexistent', 'user-1');

      expect(result).toBe(false);
      expect(prisma.star.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when the user is not a member of the message room', async () => {
      prisma.message.findUnique.mockResolvedValue({ roomId: 'room-1' });
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleStarLookup('msg-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.star.create).not.toHaveBeenCalled();
    });
  });
});
