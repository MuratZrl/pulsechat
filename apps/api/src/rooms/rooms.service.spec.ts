import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      room: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      roomMember: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      roomInvite: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  // ── createRoom ──────────────────────────────────────────────────────────────

  describe('createRoom', () => {
    it('should create a room and return formatted result', async () => {
      const now = new Date('2025-06-01');
      prisma.room.create.mockResolvedValue({
        id: 'r1',
        name: 'General',
        type: 'GROUP',
        createdById: 'u1',
        createdAt: now,
      });

      const result = await service.createRoom('u1', { name: 'General' });

      expect(result).toEqual({
        id: 'r1',
        name: 'General',
        type: 'GROUP',
        createdBy: 'u1',
        createdAt: now.toISOString(),
        unreadCount: 0,
        mentionCount: 0,
      });
      expect(prisma.room.create).toHaveBeenCalledWith({
        data: {
          name: 'General',
          createdById: 'u1',
          members: { create: { userId: 'u1', role: 'admin' } },
        },
      });
    });
  });

  // ── getRoom ─────────────────────────────────────────────────────────────────

  describe('getRoom', () => {
    const now = new Date('2025-06-01');

    it('should return room details when user is a member', async () => {
      prisma.room.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'General',
        type: 'GROUP',
        createdById: 'u1',
        createdAt: now,
        members: [
          { userId: 'u1', role: 'admin', joinedAt: now, user: { id: 'u1', name: 'Alice' } },
        ],
      });

      const result = await service.getRoom('r1', 'u1');

      expect(result.id).toBe('r1');
      expect(result.name).toBe('General');
      expect(result.members).toHaveLength(1);
      expect(result.members[0].userId).toBe('u1');
    });

    it('should throw NotFoundException when room does not exist', async () => {
      prisma.room.findUnique.mockResolvedValue(null);

      await expect(service.getRoom('bad', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prisma.room.findUnique.mockResolvedValue({
        id: 'r1',
        name: 'General',
        type: 'GROUP',
        createdById: 'u1',
        createdAt: now,
        members: [
          { userId: 'u2', role: 'admin', joinedAt: now, user: { id: 'u2', name: 'Bob' } },
        ],
      });

      await expect(service.getRoom('r1', 'u1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── joinRoom ────────────────────────────────────────────────────────────────

  describe('joinRoom', () => {
    it('should upsert membership and return success', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.roomMember.upsert.mockResolvedValue({});

      const result = await service.joinRoom('r1', 'u1');

      expect(result).toEqual({ success: true });
      expect(prisma.roomMember.upsert).toHaveBeenCalledWith({
        where: { userId_roomId: { userId: 'u1', roomId: 'r1' } },
        create: { userId: 'u1', roomId: 'r1', role: 'member' },
        update: {},
      });
    });

    it('should throw NotFoundException when room does not exist', async () => {
      prisma.room.findUnique.mockResolvedValue(null);

      await expect(service.joinRoom('bad', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── leaveRoom ───────────────────────────────────────────────────────────────

  describe('leaveRoom', () => {
    it('should delete membership and return success', async () => {
      prisma.roomMember.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.leaveRoom('r1', 'u1');

      expect(result).toEqual({ success: true });
      expect(prisma.roomMember.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', roomId: 'r1' },
      });
    });
  });

  // ── getOrCreateDm ───────────────────────────────────────────────────────────

  describe('getOrCreateDm', () => {
    it('should create a new DM when none exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', name: 'Bob' });
      prisma.room.findFirst.mockResolvedValue(null);
      prisma.room.create.mockResolvedValue({ id: 'dm1' });

      const result = await service.getOrCreateDm('u1', 'u2');

      expect(result).toEqual({ id: 'dm1', name: 'Bob', type: 'DM', isNew: true });
      expect(prisma.room.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when trying to DM yourself', async () => {
      await expect(service.getOrCreateDm('u1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getOrCreateDm('u1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── generateInvite ──────────────────────────────────────────────────────────

  describe('generateInvite', () => {
    it('should generate an invite code for an admin', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ role: 'admin' });
      prisma.roomInvite.deleteMany.mockResolvedValue({});
      prisma.roomInvite.create.mockResolvedValue({ code: 'abc123' });

      const result = await service.generateInvite('r1', 'u1');

      expect(result).toEqual({ code: 'abc123' });
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.generateInvite('r1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user has member role', async () => {
      prisma.roomMember.findUnique.mockResolvedValue({ role: 'member' });

      await expect(service.generateInvite('r1', 'u1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── joinByInvite ────────────────────────────────────────────────────────────

  describe('joinByInvite', () => {
    it('should join room via valid invite code', async () => {
      prisma.roomInvite.findUnique.mockResolvedValue({
        roomId: 'r1',
        room: { id: 'r1', name: 'General', type: 'GROUP' },
      });
      prisma.roomMember.upsert.mockResolvedValue({});

      const result = await service.joinByInvite('abc123', 'u1');

      expect(result).toEqual({ roomId: 'r1', roomName: 'General', type: 'GROUP' });
    });

    it('should throw NotFoundException for invalid invite code', async () => {
      prisma.roomInvite.findUnique.mockResolvedValue(null);

      await expect(service.joinByInvite('bad', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
