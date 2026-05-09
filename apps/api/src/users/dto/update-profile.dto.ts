import {
  IsOptional,
  IsString,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { AVATAR_PRESETS } from '../avatar-presets';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_ ]+$/, {
    message: 'Name can only contain letters, numbers, spaces, and underscores',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  // Both avatar fields accept null as an explicit "clear this field" signal,
  // so @ValidateIf skips the type checks for null but still validates real
  // values. @IsOptional alone would also accept null, but it would skip the
  // validators for any nullish value — including undefined — which is the
  // behavior we want at the field level. The mutual-exclusion rule (only
  // one of the two may be a non-null value) is enforced in UsersService.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(AVATAR_PRESETS, {
    message: `avatarPreset must be one of: ${AVATAR_PRESETS.join(', ')}`,
  })
  avatarPreset?: string | null;
}
