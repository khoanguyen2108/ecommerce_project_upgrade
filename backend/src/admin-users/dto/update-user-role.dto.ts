import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../generated/prisma/enums';

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: UserRole,
    example: UserRole.STAFF,
  })
  @IsEnum(UserRole)
  role: UserRole;
}
