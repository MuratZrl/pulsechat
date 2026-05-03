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
      createdAt: new Date('2025-01-01'),
    };

    it('should return the current user including email', async () => {
      prisma.user.findUnique.mockResolvedValue(userResult);

      const result = await service.findMe('u1');

      expect(result).toEqual(userResult);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: { id: true, name: true, email: true, bio: true, avatarUrl: true, createdAt: true },
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
      createdAt: new Date('2025-01-01'),
    };

    it('should return a public profile WITHOUT email', async () => {
      prisma.user.findUnique.mockResolvedValue(publicResult);

      const result = await service.findPublicProfile('u1');

      expect(result).toEqual(publicResult);
      expect(result).not.toHaveProperty('email');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: { id: true, name: true, bio: true, avatarUrl: true, createdAt: true },
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findPublicProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update and return the user profile', async () => {
      const updated = {
        id: 'u1',
        name: 'Alice Updated',
        email: 'alice@test.com',
        bio: 'New bio',
        avatarUrl: null,
        createdAt: new Date('2025-01-01'),
      };
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('u1', { name: 'Alice Updated', bio: 'New bio' });

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'Alice Updated', bio: 'New bio' },
        select: { id: true, name: true, email: true, bio: true, avatarUrl: true, createdAt: true },
      });
    });
  });
});
