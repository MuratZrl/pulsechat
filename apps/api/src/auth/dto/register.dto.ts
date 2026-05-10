import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsStrongPassword } from '../password-rules';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_ ]+$/, {
    message: 'Name can only contain letters, numbers, spaces, and underscores',
  })
  name: string;

  // Lowercase + trim so a single email can't register twice with different
  // casing (Foo@x.com vs foo@x.com). The DB index is a plain B-tree, so the
  // normalization MUST happen before the unique check at insert time.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  email: string;

  @IsStrongPassword()
  password: string;
}
