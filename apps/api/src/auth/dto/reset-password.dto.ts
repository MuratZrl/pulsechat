import { IsString } from 'class-validator';
import { IsStrongPassword } from '../password-rules';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsStrongPassword()
  newPassword: string;
}
