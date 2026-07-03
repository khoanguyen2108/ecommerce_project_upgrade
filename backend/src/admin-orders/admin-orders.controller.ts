import {
  Body,
  Controller,
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
  ApiBody,
  ApiConflictResponse,
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
  adminOrderDataExample,
  adminOrderListDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import { UpdateOrderFulfillmentStatusDto } from './dto/update-order-fulfillment-status.dto';

@ApiTags('admin-orders')
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
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @ApiOperation({
    summary: 'List orders as an admin',
    description:
      'Returns all orders with safe user summaries, item counts, and latest payment summaries. STAFF and CUSTOMER users are forbidden.',
  })
  @ApiOkResponse(
    envelopeResponse('Admin orders returned.', adminOrderListDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'ADMIN_ORDER_QUERY_INVALID',
      'from must be before or equal to to.',
    ),
  )
  @Get()
  listOrders(@Query() query: AdminOrderQueryDto) {
    return this.adminOrdersService.listOrders(query);
  }

  @ApiOperation({
    summary: 'Get order detail as an admin',
    description:
      'Returns order snapshots, safe user summary, payment summaries, and safe webhook event summaries.',
  })
  @ApiParam({
    description: 'Order UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('Admin order returned.', adminOrderDataExample))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Order was not found.',
      'ADMIN_ORDER_NOT_FOUND',
      'Order was not found.',
    ),
  )
  @Get(':id')
  getOrder(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminOrdersService.getOrder(id);
  }

  @ApiOperation({
    summary: 'Cancel a pending unpaid order as an admin',
    description:
      'Only PENDING_PAYMENT orders can be cancelled. This does not call payOS, mark payments paid, restore stock, or decrement stock.',
  })
  @ApiParam({
    description: 'Order UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Admin order cancelled.', adminOrderDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Order was not found.',
      'ADMIN_ORDER_NOT_FOUND',
      'Order was not found.',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Order status does not allow cancellation.',
      'ADMIN_ORDER_STATUS_INVALID',
      'Order status does not allow this admin action.',
    ),
  )
  @Patch(':id/cancel')
  cancelOrder(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminOrdersService.cancelOrder(id);
  }

  @ApiOperation({
    summary: 'Expire a pending unpaid order as an admin',
    description:
      'Only PENDING_PAYMENT orders can be expired. This does not call payOS, mark payments paid, restore stock, or decrement stock.',
  })
  @ApiParam({
    description: 'Order UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('Admin order expired.', adminOrderDataExample))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Order was not found.',
      'ADMIN_ORDER_NOT_FOUND',
      'Order was not found.',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Order status does not allow expiry.',
      'ADMIN_ORDER_STATUS_INVALID',
      'Order status does not allow this admin action.',
    ),
  )
  @Patch(':id/expire')
  expireOrder(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminOrdersService.expireOrder(id);
  }

  @ApiOperation({
    summary: 'Update delivery fulfillment status as an admin',
    description:
      'Updates fulfillment/shipping progress only for PAID orders that have not been returned. This does not mutate Payment.status, mark orders paid, call payOS, or send payment emails.',
  })
  @ApiParam({
    description: 'Order UUID.',
    name: 'id',
  })
  @ApiBody({ type: UpdateOrderFulfillmentStatusDto })
  @ApiOkResponse(
    envelopeResponse('Admin order fulfillment status updated.', adminOrderDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Fulfillment status validation failed.',
      'VALIDATION_ERROR',
      'fulfillmentStatus must be one of the allowed values.',
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Order was not found.',
      'ADMIN_ORDER_NOT_FOUND',
      'Order was not found.',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Order status does not allow fulfillment updates.',
      'ADMIN_ORDER_FULFILLMENT_REQUIRES_PAID_ORDER',
      'Fulfillment status can be updated after payment is confirmed.',
    ),
  )
  @Patch(':id/fulfillment-status')
  updateFulfillmentStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderFulfillmentStatusDto,
  ) {
    return this.adminOrdersService.updateFulfillmentStatus(id, dto);
  }
}
