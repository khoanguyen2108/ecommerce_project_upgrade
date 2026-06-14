import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthProvider, UserRole } from '../../generated/prisma/enums';

export const ADMIN_USER_SORT_OPTIONS = [
  'createdAt',
  'updatedAt',
  'email',
  'name',
  'role',
  'authProvider',
  'isActive',
] as const;
export type AdminUserSort = (typeof ADMIN_USER_SORT_OPTIONS)[number];

export const ADMIN_USER_ORDER_OPTIONS = ['asc', 'desc'] as const;
export type AdminUserOrder = (typeof ADMIN_USER_ORDER_OPTIONS)[number];

const transformOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
};

export class AdminUserQueryDto {
  @ApiPropertyOptional({
    default: 1,
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    default: 20,
    example: 20,
    maximum: 100,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Searches email, name, or phone.',
    example: 'customer@example.com',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.CUSTOMER,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: AuthProvider,
    example: AuthProvider.EMAIL,
  })
  @IsOptional()
  @IsEnum(AuthProvider)
  authProvider?: AuthProvider;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: ADMIN_USER_SORT_OPTIONS,
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(ADMIN_USER_SORT_OPTIONS)
  sort?: AdminUserSort;

  @ApiPropertyOptional({
    default: 'desc',
    enum: ADMIN_USER_ORDER_OPTIONS,
    example: 'desc',
  })
  @IsOptional()
  @IsIn(ADMIN_USER_ORDER_OPTIONS)
  order?: AdminUserOrder;
}
