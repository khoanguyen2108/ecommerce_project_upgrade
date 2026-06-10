import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordRequestOtpDto {
  @IsEmail()
  @MaxLength(320)
  email: string;
}
