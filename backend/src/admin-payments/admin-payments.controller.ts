import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
  adminEmailReadinessDataExample,
  adminPaymentDataExample,
  adminPaymentListDataExample,
  adminPayosReadinessDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto';

@ApiTags('admin-payments')
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
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @ApiOperation({
    summary: 'List payments as an admin',
    description:
      'Returns safe payment diagnostics with order and user summaries. STAFF and CUSTOMER users are forbidden.',
  })
  @ApiOkResponse(
    envelopeResponse('Admin payments returned.', adminPaymentListDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'ADMIN_PAYMENT_QUERY_INVALID',
      'from must be before or equal to to.',
    ),
  )
  @Get()
  listPayments(@Query() query: AdminPaymentQueryDto) {
    return this.adminPaymentsService.listPayments(query);
  }

  @ApiOperation({
    summary: 'Check payOS admin readiness',
    description:
      'Returns booleans and safe warnings for payOS configuration readiness. It does not call payOS or expose configured secret values.',
  })
  @ApiOkResponse(
    envelopeResponse(
      'payOS readiness returned.',
      adminPayosReadinessDataExample,
    ),
  )
  @Get('payos/readiness')
  getPayosReadiness() {
    return this.adminPaymentsService.getPayosReadiness();
  }

  @ApiOperation({
    summary: 'Check order email admin readiness',
    description:
      'Returns safe booleans for order email configuration readiness. It does not send email or expose SMTP secret values.',
  })
  @ApiOkResponse(
    envelopeResponse(
      'Order email readiness returned.',
      adminEmailReadinessDataExample,
    ),
  )
  @Get('email/readiness')
  getEmailReadiness() {
    return this.adminPaymentsService.getEmailReadiness();
  }

  @ApiOperation({
    summary: 'Get payment detail as an admin',
    description:
      'Returns safe payment detail, order and user summaries, and webhook processing summaries without raw webhook metadata or signature hashes.',
  })
  @ApiParam({
    description: 'Payment UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Admin payment returned.', adminPaymentDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Payment was not found.',
      'ADMIN_PAYMENT_NOT_FOUND',
      'Payment was not found.',
    ),
  )
  @Get(':id')
  getPayment(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminPaymentsService.getPayment(id);
  }
}
