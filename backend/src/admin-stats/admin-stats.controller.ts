import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import {
  adminOrderStatsDataExample,
  adminStatsOverviewDataExample,
  adminStatsRevenueDataExample,
  adminTopProductsDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { AdminStatsService } from './admin-stats.service';
import {
  AdminOrderStatsQueryDto,
  AdminRevenueQueryDto,
  AdminStatsDateRangeQueryDto,
  AdminTopProductsQueryDto,
} from './dto/admin-stats-query.dto';

@ApiTags('admin-stats')
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
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @ApiOperation({
    summary: 'Get admin dashboard overview metrics',
    description:
      'Revenue and paid-order metrics count only orders with PAID order state and a PAID payment. Pending, cancelled, and expired orders are excluded from revenue.',
  })
  @ApiOkResponse(
    envelopeResponse('Admin stats overview returned.', adminStatsOverviewDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Date range validation failed.',
      'STATS_DATE_RANGE_INVALID',
      'from must be before or equal to to.',
    ),
  )
  @Get('overview')
  getOverview(@Query() query: AdminStatsDateRangeQueryDto): Promise<unknown> {
    return this.adminStatsService.getOverview(query);
  }

  @ApiOperation({
    summary: 'Get paid revenue grouped by period',
    description:
      'Groups only verified paid order/payment state. The paid timestamp is used for filtering and bucket assignment.',
  })
  @ApiOkResponse(
    envelopeResponse('Admin revenue stats returned.', adminStatsRevenueDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'BAD_REQUEST',
      'groupBy must be one of the following values: day, week, month',
    ),
  )
  @Get('revenue')
  getRevenue(@Query() query: AdminRevenueQueryDto): Promise<unknown> {
    return this.adminStatsService.getRevenue(query);
  }

  @ApiOperation({
    summary: 'Get top products from paid order items',
    description:
      'Aggregates order item snapshots only from orders with PAID order state and a PAID payment.',
  })
  @ApiOkResponse(
    envelopeResponse('Admin top products returned.', adminTopProductsDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'BAD_REQUEST',
      'limit must not be greater than 50',
    ),
  )
  @Get('top-products')
  getTopProducts(@Query() query: AdminTopProductsQueryDto): Promise<unknown> {
    return this.adminStatsService.getTopProducts(query);
  }

  @ApiOperation({
    summary: 'Get order counts by status',
    description:
      'Counts orders by status using order creation time for date filtering. An optional status filter narrows the returned count set.',
  })
  @ApiOkResponse(
    envelopeResponse('Admin order stats returned.', adminOrderStatsDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'BAD_REQUEST',
      'status must be one of the following values: PENDING_PAYMENT, PAID, CANCELLED, EXPIRED',
    ),
  )
  @Get('orders')
  getOrderStats(@Query() query: AdminOrderStatsQueryDto): Promise<unknown> {
    return this.adminStatsService.getOrderStats(query);
  }
}
