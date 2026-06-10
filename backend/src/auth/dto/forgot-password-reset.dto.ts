import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordResetDto {
  @ApiProperty({
    example: 'customer@example.com',
    format: 'email',
    maxLength: 320,
  })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({
    example: '123456',
    pattern: '^\\d{6}$',
  })
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;

  @ApiProperty({
    example: 'new-strong-password-123',
    maxLength: 128,
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
