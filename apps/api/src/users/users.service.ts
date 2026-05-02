import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Authenticated current-user lookup. Includes email — only the owner of
   * the account should ever receive their own email back.
   */
  async findMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, bio: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Public profile lookup by id. Deliberately omits email so any
   * authenticated user can fetch any other user's display info without
   * leaking PII (the previous shared findById returned email here too).
   */
  async findPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, bio: true, avatarUrl: true, createdAt: true },
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
