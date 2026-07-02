import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
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
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { ReturnsService } from './returns.service';

@ApiTags('returns')
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
    'CUSTOMER role is required.',
    'FORBIDDEN',
    'You do not have permission to access this resource.',
  ),
)
@Controller('returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @ApiOperation({ summary: 'Submit a return request for a delivered order' })
  @ApiCreatedResponse(envelopeResponse('Return request submitted.', {}))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Order was not found or is not owned by this customer.',
      'RETURN_ORDER_NOT_FOUND',
      'Order was not found.',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Order is not delivered or already has a pending request.',
      'RETURN_REQUEST_PENDING_EXISTS',
      'A return request for this order is already pending review.',
    ),
  )
  @Post()
  createReturnRequest(
    @CurrentUser() customer: AuthenticatedUser,
    @Body() dto: CreateReturnRequestDto,
  ) {
    return this.returnsService.createReturnRequest(customer, dto);
  }

  @ApiOperation({ summary: 'List the current customer return requests' })
  @ApiOkResponse(envelopeResponse('Customer return requests returned.', {}))
  @Get('my')
  listMyReturnRequests(@CurrentUser() customer: AuthenticatedUser) {
    return this.returnsService.listMyReturnRequests(customer.id);
  }
}
