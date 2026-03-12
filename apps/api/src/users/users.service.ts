import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, bio: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    id: string,
    data: { name?: string; bio?: string; avatarUrl?: string },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, bio: true, avatarUrl: true, createdAt: true },
    });
  }
}
