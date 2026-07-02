import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import {
  envelopeResponse,
  errorEnvelopeResponse,
  orderDataExample,
  orderListDataExample,
} from '../common/swagger/api-examples';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiUnauthorizedResponse(
  errorEnvelopeResponse(
    'Authentication is required.',
    'AUTH_REQUIRED',
    'Authentication is required.',
  ),
)
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({
    summary: 'Create an order from selected product variants',
    description:
      'Accepts item intents only. Prices, totals, product names, SKU, size, and color are fetched and snapshotted by the backend.',
  })
  @ApiCreatedResponse(
    envelopeResponse('Pending payment order created.', orderDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Order items are invalid, inactive, out of stock, or unavailable.',
      'ORDER_ITEM_UNAVAILABLE',
      'One or more order items are not available.',
    ),
  )
  @Post()
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user, dto);
  }

  @ApiOperation({
    summary: 'List orders',
    description:
      'Customers see only their own orders. Admin users may read all orders for display purposes.',
  })
  @ApiOkResponse(envelopeResponse('Orders returned.', orderListDataExample))
  @Get()
  listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.listOrders(user, query);
  }

  @ApiOperation({
    summary: 'Get an order by ID',
    description:
      'Customers can read only their own orders. Admin users may read any order for display purposes.',
  })
  @ApiParam({
    description: 'Order UUID or public order code.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('Order returned.', orderDataExample))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Order was not found or is not visible to the current user.',
      'ORDER_NOT_FOUND',
      'Order was not found.',
    ),
  )
  @Get(':id')
  getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.ordersService.getOrder(user, id);
  }
}
