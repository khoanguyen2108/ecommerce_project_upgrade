import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import {
  adminVoucherDataExample,
  adminVoucherListDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { AdminVouchersService } from './admin-vouchers.service';
import { AdminVoucherQueryDto } from './dto/admin-voucher-query.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';

@ApiTags('admin-vouchers')
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
@Controller('admin/vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminVouchersController {
  constructor(private readonly adminVouchersService: AdminVouchersService) {}

  @ApiOperation({ summary: 'List vouchers as an admin' })
  @ApiOkResponse(envelopeResponse('Vouchers returned.', adminVoucherListDataExample))
  @Get()
  listVouchers(@Query() query: AdminVoucherQueryDto) {
    return this.adminVouchersService.listVouchers(query);
  }

  @ApiOperation({ summary: 'Get a voucher as an admin' })
  @ApiParam({ description: 'Voucher UUID.', name: 'id' })
  @ApiOkResponse(envelopeResponse('Voucher returned.', adminVoucherDataExample))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Voucher was not found.',
      'VOUCHER_NOT_FOUND',
      'Voucher was not found.',
    ),
  )
  @Get(':id')
  getVoucher(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminVouchersService.getVoucher(id);
  }

  @ApiOperation({ summary: 'Create a voucher as an admin' })
  @ApiCreatedResponse(envelopeResponse('Voucher created.', adminVoucherDataExample))
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Voucher validation failed.',
      'VOUCHER_RULE_INVALID',
      'Voucher business rules are invalid.',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Voucher code already exists.',
      'VOUCHER_CODE_EXISTS',
      'A voucher with this code already exists.',
    ),
  )
  @Post()
  createVoucher(@Body() dto: CreateVoucherDto) {
    return this.adminVouchersService.createVoucher(dto);
  }

  @ApiOperation({ summary: 'Update a voucher as an admin' })
  @ApiOkResponse(envelopeResponse('Voucher updated.', adminVoucherDataExample))
  @Patch(':id')
  updateVoucher(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.adminVouchersService.updateVoucher(id, dto);
  }

  @ApiOperation({ summary: 'Activate a voucher as an admin' })
  @ApiOkResponse(envelopeResponse('Voucher activated.', adminVoucherDataExample))
  @Patch(':id/activate')
  activateVoucher(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminVouchersService.setVoucherActive(id, true);
  }

  @ApiOperation({ summary: 'Deactivate a voucher as an admin' })
  @ApiOkResponse(envelopeResponse('Voucher deactivated.', adminVoucherDataExample))
  @Patch(':id/deactivate')
  deactivateVoucher(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminVouchersService.setVoucherActive(id, false);
  }

  @ApiOperation({ summary: 'Safely delete an unused voucher as an admin' })
  @Delete(':id')
  deleteVoucher(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminVouchersService.deleteVoucher(id);
  }
}
