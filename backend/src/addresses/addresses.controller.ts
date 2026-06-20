import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import { addressDataExample, addressListDataExample, envelopeResponse } from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/address-fields.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('addresses')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@Controller('addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List the current customer saved addresses' })
  @ApiOkResponse(envelopeResponse('Addresses returned.', addressListDataExample))
  list(@CurrentUser() user: AuthenticatedUser) { return this.addressesService.list(user); }

  @Post()
  @ApiOperation({ summary: 'Create a saved address for the current customer' })
  @ApiCreatedResponse(envelopeResponse('Address created.', addressDataExample))
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto) { return this.addressesService.create(user, dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an owned saved address' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateAddressDto) { return this.addressesService.update(user, id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an owned saved address' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.addressesService.remove(user, id); }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Make an owned saved address the default' })
  setDefault(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.addressesService.setDefault(user, id); }
}
