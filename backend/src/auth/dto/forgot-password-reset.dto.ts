import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordResetDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
