import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findById', () => {
    const userResult = {
      id: 'u1',
      name: 'Alice',
      email: 'alice@test.com',
      bio: 'Hello',
      avatarUrl: null,
      createdAt: new Date('2025-01-01'),
    };

    it('should return a user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(userResult);

      const result = await service.findById('u1');

      expect(result).toEqual(userResult);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: { id: true, name: true, email: true, bio: true, avatarUrl: true, createdAt: true },
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
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
