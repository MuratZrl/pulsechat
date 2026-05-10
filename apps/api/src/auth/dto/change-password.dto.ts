import { IsString } from 'class-validator';
import { IsStrongPassword } from '../password-rules';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
