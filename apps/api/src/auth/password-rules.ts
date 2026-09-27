import { applyDecorators } from '@nestjs/common';
import { IsByteLength, IsString, Matches, MinLength } from 'class-validator';

// Single source of truth for password complexity. Every DTO that accepts a
// new password (RegisterDto.password, ResetPasswordDto.newPassword,
// ChangePasswordDto.newPassword) MUST use @IsStrongPassword() so the rule
// can never drift between endpoints — the previous bug was reset/change
// only checking length, letting a Password1!-registered user reset to
// aaaaaa and bypass the regex enforced at registration.
export const PASSWORD_MIN_LENGTH = 6;
// bcrypt only hashes the first 72 bytes, so anything longer would be
// silently ignored. Measured in UTF-8 bytes, not characters. (Login keeps
// accepting up to 128 chars for accounts created before this cap.)
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_RULE_MESSAGE =
  'Password must contain at least one uppercase letter, one number, and one special character';

export function IsStrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH),
    IsByteLength(0, PASSWORD_MAX_BYTES, {
      message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
    }),
    Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE }),
  );
}
