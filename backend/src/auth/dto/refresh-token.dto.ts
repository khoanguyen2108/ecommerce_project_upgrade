import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'refresh_token_placeholder_value_123',
    maxLength: 512,
    minLength: 32,
  })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  refreshToken: string;
}
