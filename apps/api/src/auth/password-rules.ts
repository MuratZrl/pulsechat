import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Single source of truth for password complexity. Every DTO that accepts a
// new password (RegisterDto.password, ResetPasswordDto.newPassword,
// ChangePasswordDto.newPassword) MUST use @IsStrongPassword() so the rule
// can never drift between endpoints — the previous bug was reset/change
// only checking length, letting a Password1!-registered user reset to
// aaaaaa and bypass the regex enforced at registration.
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_RULE_MESSAGE =
  'Password must contain at least one uppercase letter, one number, and one special character';

export function IsStrongPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH),
    MaxLength(PASSWORD_MAX_LENGTH),
    Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE }),
  );
}
