import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
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
  payosPaymentDataExample,
  payosStatusDataExample,
  payosWebhookDataExample,
} from '../common/swagger/api-examples';
import { CreatePayosPaymentDto } from './dto/create-payos-payment.dto';
import { PayosStatusQueryDto } from './dto/payos-status-query.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments/payos')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Create or reuse a payOS checkout link for an order',
    description:
      'Creates a provider checkout link from backend-calculated order data. This endpoint never marks the order or payment as paid.',
  })
  @ApiCreatedResponse(
    envelopeResponse('payOS checkout link created.', payosPaymentDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Order is not payable.',
      'ORDER_NOT_PENDING_PAYMENT',
      'Order is not pending payment.',
    ),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Authentication is required.',
      'AUTH_REQUIRED',
      'Authentication is required.',
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Order was not found or is not visible to the current user.',
      'ORDER_NOT_FOUND',
      'Order was not found.',
    ),
  )
  @ApiServiceUnavailableResponse(
    errorEnvelopeResponse(
      'payOS credentials or URLs are missing.',
      'PAYOS_CONFIGURATION_ERROR',
      'payOS payment is not configured.',
    ),
  )
  @Post('create')
  @UseGuards(JwtAuthGuard)
  createPayosPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayosPaymentDto,
  ) {
    return this.paymentsService.createPayosPayment(user, dto);
  }

  @ApiOperation({
    summary: 'Receive a payOS webhook',
    description:
      'Public HTTP endpoint. The payload is verified with payOS before any payment, order, or stock state is mutated. Duplicate verified events are idempotent.',
  })
  @ApiBody({
    schema: {
      example: {
        code: '00',
        desc: 'success',
        success: true,
        data: {
          orderCode: 100001,
          amount: 249000,
          description: 'Belikeme 100001',
          accountNumber: 'redacted-by-provider',
          reference: 'TF230204212323',
          transactionDateTime: '2026-06-14 12:00:00',
          currency: 'VND',
          paymentLinkId: '124c33293c43417ab7879e14c8d9eb18',
          code: '00',
          desc: 'Success',
        },
        signature: 'signature_from_payos',
      },
    },
  })
  @ApiOkResponse(
    envelopeResponse('Webhook accepted.', payosWebhookDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Webhook signature or payload is invalid.',
      'PAYOS_WEBHOOK_INVALID',
      'payOS webhook could not be verified.',
    ),
  )
  @ApiServiceUnavailableResponse(
    errorEnvelopeResponse(
      'payOS credentials are missing.',
      'PAYOS_CONFIGURATION_ERROR',
      'payOS payment is not configured.',
    ),
  )
  @Post('webhook')
  @HttpCode(200)
  handlePayosWebhook(@Body() body: unknown) {
    return this.paymentsService.handlePayosWebhook(body);
  }

  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Read display-only payOS return status',
    description:
      'Display-only read for browser return pages. It never marks payment or order state as paid.',
  })
  @ApiOkResponse(
    envelopeResponse('Display-only payment status returned.', payosStatusDataExample),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Authentication is required.',
      'AUTH_REQUIRED',
      'Authentication is required.',
    ),
  )
  @Get('return/status')
  @UseGuards(JwtAuthGuard)
  getReturnStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PayosStatusQueryDto,
  ) {
    return this.paymentsService.getPayosDisplayStatus(user, query, 'return');
  }

  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Read display-only payOS cancel status',
    description:
      'Display-only read for browser cancel pages. It never marks payment or order state as paid.',
  })
  @ApiOkResponse(
    envelopeResponse('Display-only payment status returned.', payosStatusDataExample),
  )
  @ApiUnauthorizedResponse(
    errorEnvelopeResponse(
      'Authentication is required.',
      'AUTH_REQUIRED',
      'Authentication is required.',
    ),
  )
  @Get('cancel/status')
  @UseGuards(JwtAuthGuard)
  getCancelStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PayosStatusQueryDto,
  ) {
    return this.paymentsService.getPayosDisplayStatus(user, query, 'cancel');
  }
}
