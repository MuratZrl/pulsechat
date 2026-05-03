import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

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
    data: { name?: string; bio?: string; avatarUrl?: string | null },
  ) {
    // Avatar URL whitelist. `null` and `""` clear the avatar — only non-empty
    // strings need the prefix check. Trailing slash defeats lookalike domains.
    if (typeof data.avatarUrl === 'string' && data.avatarUrl.length > 0) {
      const r2PublicUrl = this.config.getOrThrow<string>('R2_PUBLIC_URL');
      if (!data.avatarUrl.startsWith(`${r2PublicUrl}/`)) {
        throw new BadRequestException('Avatar URL is not from an allowed source');
      }
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, bio: true, avatarUrl: true, createdAt: true },
      });
    } catch (err) {
      // updateProfile only accepts name/bio/avatarUrl, never email — so any
      // P2002 here is unambiguously a name collision (functional unique index
      // on LOWER(name)).
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Name is already taken');
      }
      throw err;
    }
  }
}
