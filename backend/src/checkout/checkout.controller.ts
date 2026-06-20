import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import {
  checkoutSummaryDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
  orderDataExample,
} from '../common/swagger/api-examples';
import { CheckoutService } from './checkout.service';
import { CheckoutVoucherDto } from './dto/checkout-voucher.dto';
import { CreateCheckoutOrderDto } from './dto/create-checkout-order.dto';

@ApiTags('checkout')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiUnauthorizedResponse(
  errorEnvelopeResponse(
    'Authentication is required.',
    'AUTH_REQUIRED',
    'Authentication is required.',
  ),
)
@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @ApiOperation({
    summary: 'Preview checkout from the current authenticated user cart',
    description:
      'Revalidates cart items and recalculates prices from current backend catalog data. This endpoint does not create an order, clear cart items, create payment, or mutate stock.',
  })
  @ApiOkResponse(
    envelopeResponse('Checkout summary returned.', checkoutSummaryDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Cart is empty or contains unavailable items.',
      'CHECKOUT_CART_EMPTY',
      'Cart is empty.',
    ),
  )
  @Get('summary')
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CheckoutVoucherDto,
  ) {
    return this.checkoutService.getSummary(user, query.voucherCode);
  }

  @ApiOperation({
    summary: 'Create a pending-payment order from the current authenticated user cart',
    description:
      'Runs in a transaction, revalidates cart items, snapshots order items, then clears the cart. It does not create payment, call payOS, mark paid, reserve stock, or decrement stock.',
  })
  @ApiCreatedResponse(
    envelopeResponse('Pending payment order created.', orderDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Cart is empty or contains unavailable items.',
      'CHECKOUT_ITEM_STOCK_UNAVAILABLE',
      'Requested quantity is not available for this item.',
    ),
  )
  @Post('orders')
  createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutOrderDto,
  ) {
    return this.checkoutService.createOrderFromCart(user, dto);
  }
}
