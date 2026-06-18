import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
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
import { errorEnvelopeResponse } from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { LandingPageService } from './landing-page.service';

@ApiTags('admin-landing-page')
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
@Controller('admin/landing-page')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminLandingPageController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @ApiOperation({ summary: 'Get landing page settings as an admin' })
  @ApiOkResponse({ description: 'Landing page settings returned.' })
  @Get()
  getLandingPage() {
    return this.landingPageService.getAdminLandingPage();
  }

  @ApiOperation({ summary: 'Update landing page settings as an admin' })
  @ApiOkResponse({ description: 'Landing page settings updated.' })
  @Patch()
  updateLandingPage(@Body() dto: UpdateLandingPageDto) {
    return this.landingPageService.updateAdminLandingPage(dto);
  }
}
