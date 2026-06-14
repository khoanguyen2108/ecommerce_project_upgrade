import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminUserDto {
  @ApiPropertyOptional({
    example: 'Belikeme Customer',
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @ApiPropertyOptional({
    example: '+84901234567',
    maxLength: 32,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;
}
