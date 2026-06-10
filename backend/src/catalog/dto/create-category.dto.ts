import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(160)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean | null;
}
