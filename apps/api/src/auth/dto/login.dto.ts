import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  // Mirror RegisterDto's normalization — without it a user who registered
  // as Foo@x.com (post-transform: foo@x.com) couldn't log in by typing
  // Foo@x.com again, because the DB lookup is case-sensitive.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
