import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
  cartDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiUnauthorizedResponse(
  errorEnvelopeResponse(
    'Authentication is required.',
    'AUTH_REQUIRED',
    'Authentication is required.',
  ),
)
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: 'Get the current authenticated user cart' })
  @ApiOkResponse(envelopeResponse('Cart returned.', cartDataExample))
  @Get()
  getCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.getCart(user);
  }

  @ApiOperation({
    summary: 'Add an item to the current authenticated user cart',
    description:
      'If the variant is already in the cart, the quantity is increased. Prices and totals are calculated from current backend catalog data.',
  })
  @ApiCreatedResponse(envelopeResponse('Cart item added.', cartDataExample))
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Variant is inactive, unavailable, out of stock, or quantity is invalid.',
      'CART_ITEM_STOCK_UNAVAILABLE',
      'Requested quantity is not available for this item.',
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Variant was not found.',
      'CART_VARIANT_NOT_FOUND',
      'Product variant was not found.',
    ),
  )
  @Post('items')
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(user, dto);
  }

  @ApiOperation({ summary: 'Set a cart item quantity directly' })
  @ApiParam({
    description: 'Cart item UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('Cart item updated.', cartDataExample))
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Variant is inactive, unavailable, out of stock, or quantity is invalid.',
      'CART_ITEM_QUANTITY_INVALID',
      'Cart item quantity must be an integer from 1 to 99.',
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Cart item was not found or is not visible to the current user.',
      'CART_ITEM_NOT_FOUND',
      'Cart item was not found.',
    ),
  )
  @Patch('items/:id')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(user, id, dto);
  }

  @ApiOperation({ summary: 'Remove a cart item' })
  @ApiParam({
    description: 'Cart item UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('Cart item removed.', cartDataExample))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Cart item was not found or is not visible to the current user.',
      'CART_ITEM_NOT_FOUND',
      'Cart item was not found.',
    ),
  )
  @Delete('items/:id')
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.cartService.removeItem(user, id);
  }

  @ApiOperation({ summary: 'Clear the current authenticated user cart' })
  @ApiOkResponse(envelopeResponse('Cart cleared.', cartDataExample))
  @Delete()
  clearCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.clearCart(user);
  }
}
