import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('https://test-r2.example'),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findMe', () => {
    const userResult = {
      id: 'u1',
      name: 'Alice',
      email: 'alice@test.com',
      bio: 'Hello',
      avatarUrl: null,
      avatarPreset: null,
      createdAt: new Date('2025-01-01'),
    };

    it('should return the current user including email', async () => {
      prisma.user.findUnique.mockResolvedValue(userResult);

      const result = await service.findMe('u1');

      expect(result).toEqual(userResult);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: {
          id: true,
          name: true,
          email: true,
          bio: true,
          avatarUrl: true,
          avatarPreset: true,
          createdAt: true,
        },
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findMe('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPublicProfile', () => {
    const publicResult = {
      id: 'u1',
      name: 'Alice',
      bio: 'Hello',
      avatarUrl: null,
      avatarPreset: null,
      createdAt: new Date('2025-01-01'),
    };

    it('should return a public profile WITHOUT email', async () => {
      prisma.user.findUnique.mockResolvedValue(publicResult);

      const result = await service.findPublicProfile('u1');

      expect(result).toEqual(publicResult);
      expect(result).not.toHaveProperty('email');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: {
          id: true,
          name: true,
          bio: true,
          avatarUrl: true,
          avatarPreset: true,
          createdAt: true,
        },
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findPublicProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    const fullSelect = {
      id: true,
      name: true,
      email: true,
      bio: true,
      avatarUrl: true,
      avatarPreset: true,
      createdAt: true,
    };

    it('should update and return the user profile', async () => {
      const updated = {
        id: 'u1',
        name: 'Alice Updated',
        email: 'alice@test.com',
        bio: 'New bio',
        avatarUrl: null,
        avatarPreset: null,
        createdAt: new Date('2025-01-01'),
      };
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('u1', { name: 'Alice Updated', bio: 'New bio' });

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'Alice Updated', bio: 'New bio' },
        select: fullSelect,
      });
    });

    it('should persist a preset and explicitly clear avatarUrl', async () => {
      const updated = {
        id: 'u1',
        name: 'Alice',
        email: 'alice@test.com',
        bio: 'Hello',
        avatarUrl: null,
        avatarPreset: 'fox',
        createdAt: new Date('2025-01-01'),
      };
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('u1', {
        avatarUrl: null,
        avatarPreset: 'fox',
      });

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { avatarUrl: null, avatarPreset: 'fox' },
        select: fullSelect,
      });
    });

    it('should reject when both avatarUrl and avatarPreset are non-null', async () => {
      await expect(
        service.updateProfile('u1', {
          avatarUrl: 'https://test-r2.example/avatars/abc.png',
          avatarPreset: 'cat',
        }),
      ).rejects.toThrow('Cannot set both avatarUrl and avatarPreset — choose one');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject an unknown preset id', async () => {
      await expect(
        service.updateProfile('u1', { avatarPreset: 'lobster' }),
      ).rejects.toThrow('Invalid avatar preset');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject avatarUrl from a non-R2 origin', async () => {
      await expect(
        service.updateProfile('u1', {
          avatarUrl: 'https://attacker.example/foo.png',
        }),
      ).rejects.toThrow('Avatar URL is not from an allowed source');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
