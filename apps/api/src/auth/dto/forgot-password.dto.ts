import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  // Same lowercase + trim as RegisterDto/LoginDto. Without it the
  // anti-enumeration "If that email exists, a reset link has been sent"
  // message hides a silent failure: a user registered as foo@x.com would
  // never receive a reset email when typing Foo@x.com here.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  email: string;
}
