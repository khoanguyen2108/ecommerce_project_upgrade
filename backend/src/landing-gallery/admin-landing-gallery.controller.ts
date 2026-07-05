import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  type ProductImageUpload,
} from '../assets/asset.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import { errorEnvelopeResponse } from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { CreateLandingGalleryImageDto } from './dto/create-landing-gallery-image.dto';
import { ReorderLandingGalleryImagesDto } from './dto/reorder-landing-gallery-images.dto';
import { UpdateLandingGalleryImageDto } from './dto/update-landing-gallery-image.dto';
import { LandingGalleryService } from './landing-gallery.service';

@ApiTags('admin-landing-gallery')
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
@Controller('admin/landing-gallery')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminLandingGalleryController {
  constructor(private readonly landingGalleryService: LandingGalleryService) {}

  @ApiOperation({ summary: 'List landing gallery images as an admin' })
  @ApiOkResponse({ description: 'Landing gallery images returned.' })
  @Get()
  listImages() {
    return this.landingGalleryService.listAdminImages();
  }

  @ApiOperation({ summary: 'Create a landing gallery image as an admin' })
  @ApiOkResponse({ description: 'Landing gallery image created.' })
  @Post()
  createImage(@Body() dto: CreateLandingGalleryImageDto) {
    return this.landingGalleryService.createAdminImage(dto);
  }

  @ApiOperation({ summary: 'Upload or replace a managed gallery image' })
  @ApiConsumes('multipart/form-data')
  @Post(':imageId/image')
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fieldNameSize: 100,
        fields: 0,
        fileSize: MAX_PRODUCT_IMAGE_BYTES,
        files: 1,
      },
    }),
  )
  uploadImageFile(
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: ProductImageUpload,
  ) {
    return this.landingGalleryService.uploadAdminImage(
      imageId,
      user.id,
      file,
    );
  }

  @ApiOperation({ summary: 'Remove a managed or legacy gallery image file' })
  @Delete(':imageId/image')
  deleteImageFile(@Param('imageId', new ParseUUIDPipe()) imageId: string) {
    return this.landingGalleryService.deleteAdminImageFile(imageId);
  }

  @ApiOperation({ summary: 'Reorder landing gallery images as an admin' })
  @ApiOkResponse({ description: 'Landing gallery images reordered.' })
  @Patch('reorder')
  reorderImages(@Body() dto: ReorderLandingGalleryImagesDto) {
    return this.landingGalleryService.reorderAdminImages(dto);
  }

  @ApiOperation({ summary: 'Update a landing gallery image as an admin' })
  @ApiParam({ description: 'Landing gallery image UUID.', name: 'imageId' })
  @ApiOkResponse({ description: 'Landing gallery image updated.' })
  @Patch(':imageId')
  updateImage(
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Body() dto: UpdateLandingGalleryImageDto,
  ) {
    return this.landingGalleryService.updateAdminImage(imageId, dto);
  }

  @ApiOperation({ summary: 'Delete a landing gallery image as an admin' })
  @ApiParam({ description: 'Landing gallery image UUID.', name: 'imageId' })
  @Delete(':imageId')
  deleteImage(@Param('imageId', new ParseUUIDPipe()) imageId: string) {
    return this.landingGalleryService.deleteAdminImage(imageId);
  }
}
