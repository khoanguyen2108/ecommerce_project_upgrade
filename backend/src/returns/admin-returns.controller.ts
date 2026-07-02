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
  ApiBearerAuth,
  ApiConflictResponse,
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
import { AdminReturnQueryDto } from './dto/admin-return-query.dto';
import { ReviewReturnRequestDto } from './dto/review-return-request.dto';
import { ReturnsService } from './returns.service';

@ApiTags('admin-returns')
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
@Controller('admin/returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @ApiOperation({ summary: 'List return requests as an admin' })
  @ApiOkResponse(envelopeResponse('Admin return requests returned.', {}))
  @Get()
  listReturns(@Query() query: AdminReturnQueryDto) {
    return this.returnsService.listAdminReturns(query);
  }

  @ApiOperation({ summary: 'Get one return request as an admin' })
  @ApiOkResponse(envelopeResponse('Admin return request returned.', {}))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Return request was not found.',
      'RETURN_REQUEST_NOT_FOUND',
      'Return request was not found.',
    ),
  )
  @Get(':id')
  getReturn(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.returnsService.getAdminReturn(id);
  }

  @ApiOperation({ summary: 'Approve or reject a pending return request' })
  @ApiOkResponse(envelopeResponse('Return request reviewed.', {}))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Return request was not found.',
      'RETURN_REQUEST_NOT_FOUND',
      'Return request was not found.',
    ),
  )
  @ApiConflictResponse(
    errorEnvelopeResponse(
      'Return request was already reviewed.',
      'RETURN_REQUEST_ALREADY_REVIEWED',
      'Return request has already been reviewed.',
    ),
  )
  @Patch(':id/review')
  reviewReturn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewReturnRequestDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.returnsService.reviewReturnRequest(id, dto, admin.id);
  }
}
