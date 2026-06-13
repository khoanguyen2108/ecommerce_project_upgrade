import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token returned by login/register/refresh. Optional when the belikeme_refresh_token HTTP-only cookie is present.',
    example: 'refresh_token_placeholder_value_123',
    maxLength: 512,
    minLength: 32,
  })
  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  refreshToken?: string;
}
