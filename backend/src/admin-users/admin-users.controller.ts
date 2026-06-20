import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import {
  adminUserDataExample,
  adminUserListDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { AdminUsersService } from './admin-users.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('admin-users')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiUnauthorizedResponse(
  errorEnvelopeResponse(
    'Authentication is required.',
    'AUTH_REQUIRED',
    'Authentication is required.',
  ),
)
@ApiForbiddenResponse(
  errorEnvelopeResponse(
    'ADMIN role is required.',
    'FORBIDDEN',
    'You do not have permission to access this resource.',
  ),
)
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @ApiOperation({ summary: 'List users as an admin' })
  @ApiOkResponse(
    envelopeResponse('Users returned.', adminUserListDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'BAD_REQUEST',
      'role must be one of the following values: CUSTOMER, STAFF, ADMIN',
    ),
  )
  @Get()
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @ApiOperation({ summary: 'Get a user as an admin' })
  @ApiParam({
    description: 'User UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('User returned.', adminUserDataExample))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'User was not found.',
      'USER_NOT_FOUND',
      'User was not found.',
    ),
  )
  @Get(':id')
  getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminUsersService.getUser(id);
  }

  @ApiOperation({
    summary: 'Update safe user profile fields as an admin',
    description: 'Only name and phone can be changed by this endpoint.',
  })
  @ApiParam({
    description: 'User UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('User updated.', adminUserDataExample))
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'No safe update fields were provided or validation failed.',
      'ADMIN_USER_UPDATE_EMPTY',
      'Provide at least one field to update.',
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'User was not found.',
      'USER_NOT_FOUND',
      'User was not found.',
    ),
  )
  @Patch(':id')
  updateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminUsersService.updateUser(id, dto);
  }

  @ApiOperation({ summary: 'Activate or deactivate a user as an admin' })
  @ApiParam({
    description: 'User UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('User status updated.', adminUserDataExample))
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'BAD_REQUEST',
      'isActive must be a boolean value',
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'User was not found.',
      'USER_NOT_FOUND',
      'User was not found.',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Last active admin protection blocked the change.',
      'LAST_ACTIVE_ADMIN',
      'At least one active admin account must remain.',
    ),
  )
  @Patch(':id/status')
  updateUserStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.updateUserStatus(id, dto, admin.id);
  }

  @ApiOperation({ summary: 'Activate a user as an admin' })
  @Patch(':id/activate')
  activateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.updateUserStatus(
      id,
      { isActive: true },
      admin.id,
    );
  }

  @ApiOperation({ summary: 'Deactivate a user as an admin' })
  @Patch(':id/deactivate')
  deactivateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.updateUserStatus(
      id,
      { isActive: false },
      admin.id,
    );
  }

  @ApiOperation({ summary: 'Safely delete an unreferenced user as an admin' })
  @Delete(':id')
  deleteUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.deleteUser(id, admin.id);
  }

  @ApiOperation({ summary: 'Change a user role as an admin' })
  @ApiParam({
    description: 'User UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('User role updated.', adminUserDataExample))
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Request validation failed.',
      'BAD_REQUEST',
      'role must be one of the following values: CUSTOMER, STAFF, ADMIN',
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'User was not found.',
      'USER_NOT_FOUND',
      'User was not found.',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Last active admin protection blocked the change.',
      'LAST_ACTIVE_ADMIN',
      'At least one active admin account must remain.',
    ),
  )
  @Patch(':id/role')
  updateUserRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.updateUserRole(id, dto, admin.id);
  }
}
