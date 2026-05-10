import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

// DTO-level tests verify behavior the global ValidationPipe applies on
// every request: class-transformer @Transform runs first, then
// class-validator decorators are checked. Service-level mocks bypass this
// pipeline entirely, so these guarantees would otherwise be untested.

function findError(
  errors: ValidationError[],
  property: string,
): ValidationError | undefined {
  return errors.find((e) => e.property === property);
}

describe('Password rule enforcement (Bug 1)', () => {
  describe('ResetPasswordDto.newPassword', () => {
    it('rejects a weak short password', async () => {
      const errors = await validate(
        plainToInstance(ResetPasswordDto, {
          token: 't',
          newPassword: 'aaaaaa',
        }),
      );
      const err = findError(errors, 'newPassword');
      expect(err).toBeDefined();
      // The regex constraint is what catches the all-lowercase case here —
      // length 6 passes MinLength but fails the uppercase/digit/special check.
      expect(err!.constraints).toMatchObject({
        matches: expect.stringContaining('uppercase'),
      });
    });

    it('rejects a password that is too short even if it would pass complexity', async () => {
      const errors = await validate(
        plainToInstance(ResetPasswordDto, {
          token: 't',
          newPassword: 'A1!',
        }),
      );
      const err = findError(errors, 'newPassword');
      expect(err).toBeDefined();
      expect(err!.constraints).toHaveProperty('minLength');
    });

    it('accepts a strong password', async () => {
      const errors = await validate(
        plainToInstance(ResetPasswordDto, {
          token: 't',
          newPassword: 'NewPass1!',
        }),
      );
      expect(findError(errors, 'newPassword')).toBeUndefined();
    });
  });

  describe('ChangePasswordDto.newPassword', () => {
    it('rejects a weak password (length only, no complexity)', async () => {
      const errors = await validate(
        plainToInstance(ChangePasswordDto, {
          currentPassword: 'OldPass1!',
          newPassword: 'aaaaaa',
        }),
      );
      const err = findError(errors, 'newPassword');
      expect(err).toBeDefined();
      expect(err!.constraints).toMatchObject({
        matches: expect.stringContaining('uppercase'),
      });
    });

    it('accepts a strong password', async () => {
      const errors = await validate(
        plainToInstance(ChangePasswordDto, {
          currentPassword: 'OldPass1!',
          newPassword: 'NewPass1!',
        }),
      );
      expect(findError(errors, 'newPassword')).toBeUndefined();
    });
  });

  describe('RegisterDto.password (regression)', () => {
    it('still rejects weak passwords after refactor to shared rule', async () => {
      const errors = await validate(
        plainToInstance(RegisterDto, {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'aaaaaa',
        }),
      );
      const err = findError(errors, 'password');
      expect(err).toBeDefined();
    });

    it('accepts strong passwords', async () => {
      const errors = await validate(
        plainToInstance(RegisterDto, {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password1!',
        }),
      );
      expect(findError(errors, 'password')).toBeUndefined();
    });
  });
});

describe('Email normalization (Bug 3)', () => {
  it('lowercases and trims RegisterDto.email', () => {
    const instance = plainToInstance(RegisterDto, {
      name: 'John Doe',
      email: '  Foo@Example.COM  ',
      password: 'Password1!',
    });
    expect(instance.email).toBe('foo@example.com');
  });

  it('lowercases LoginDto.email', () => {
    const instance = plainToInstance(LoginDto, {
      email: 'FOO@EXAMPLE.COM',
      password: 'Password1!',
    });
    expect(instance.email).toBe('foo@example.com');
  });

  it('lowercases ForgotPasswordDto.email', () => {
    const instance = plainToInstance(ForgotPasswordDto, {
      email: 'Foo@Example.com',
    });
    expect(instance.email).toBe('foo@example.com');
  });

  it('passes a non-string email through untouched (defensive — class-validator rejects later)', () => {
    const instance = plainToInstance(LoginDto, {
      email: 12345 as unknown as string,
      password: 'Password1!',
    });
    expect(instance.email).toBe(12345);
  });
});
