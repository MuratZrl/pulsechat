import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AVATAR_PRESETS, AvatarPreset } from './avatar-presets';

// Field set returned to the owner of the account — includes email.
const ME_SELECT = {
  id: true,
  name: true,
  email: true,
  bio: true,
  avatarUrl: true,
  avatarPreset: true,
  createdAt: true,
} as const;

// Public profile — strips email so any authenticated user can fetch any
// other user's display info without leaking PII.
const PUBLIC_SELECT = {
  id: true,
  name: true,
  bio: true,
  avatarUrl: true,
  avatarPreset: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async findMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: ME_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    id: string,
    input: {
      name?: string;
      bio?: string;
      avatarUrl?: string | null;
      avatarPreset?: string | null;
    },
  ) {
    const { name, bio, avatarUrl, avatarPreset } = input;

    // Mutual exclusion: a request can clear either field (null) or set one of
    // them, but never set both at once. If the caller wants to switch from
    // custom upload to a preset (or vice versa), they send the new field set
    // plus an explicit null for the other.
    const settingUrl =
      avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== '';
    const settingPreset = avatarPreset !== undefined && avatarPreset !== null;
    if (settingUrl && settingPreset) {
      throw new BadRequestException(
        'Cannot set both avatarUrl and avatarPreset — choose one',
      );
    }

    // R2 whitelist for custom uploads. `null` and `""` mean clear; only
    // non-empty strings need the prefix check. Trailing slash defeats
    // lookalike domains.
    if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
      const r2PublicUrl = this.config.getOrThrow<string>('R2_PUBLIC_URL');
      if (!avatarUrl.startsWith(`${r2PublicUrl}/`)) {
        throw new BadRequestException('Avatar URL is not from an allowed source');
      }
    }

    // Defense-in-depth: the DTO already constrains avatarPreset via @IsIn,
    // but the service receives a plain object — re-check so we don't trust
    // a caller that bypassed the pipe (e.g. a future internal call site).
    if (
      typeof avatarPreset === 'string' &&
      !(AVATAR_PRESETS as readonly string[]).includes(avatarPreset)
    ) {
      throw new BadRequestException('Invalid avatar preset');
    }

    // Build the update payload field-by-field so that:
    //  - explicit `null` clears the column,
    //  - explicit value writes it,
    //  - `undefined` is omitted entirely (Prisma leaves the column alone).
    const data: Prisma.UserUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (bio !== undefined) data.bio = bio;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (avatarPreset !== undefined) {
      data.avatarPreset = avatarPreset as AvatarPreset | null;
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: ME_SELECT,
      });
    } catch (err) {
      // updateProfile only accepts name/bio/avatar fields, never email — so
      // any P2002 here is unambiguously a name collision (functional unique
      // index on LOWER(name)).
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
