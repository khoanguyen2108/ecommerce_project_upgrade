import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import {
  adminCategoryListDataExample,
  categoryDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { CatalogService } from './catalog.service';
import { AdminCategoryQueryDto } from './dto/admin-category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ReorderCategoryDto } from './dto/reorder-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('admin-categories')
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
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @ApiOperation({ summary: 'List categories as an admin' })
  @ApiOkResponse(
    envelopeResponse('Categories returned.', adminCategoryListDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'BAD_REQUEST',
      'isActive must be a boolean value',
    ),
  )
  @Get()
  listCategories(@Query() query: AdminCategoryQueryDto) {
    return this.catalogService.listAdminCategories(query);
  }

  @ApiOperation({ summary: 'Get a category as an admin' })
  @ApiParam({
    description: 'Category UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('Category returned.', categoryDataExample))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Category was not found.',
      'CATEGORY_NOT_FOUND',
      'Category was not found.',
    ),
  )
  @Get(':id')
  getCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getAdminCategory(id);
  }

  @ApiOperation({ summary: 'Create a category as an admin' })
  @ApiCreatedResponse(
    envelopeResponse('Category created.', categoryDataExample),
  )
  @Post()
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(dto);
  }

  @ApiOperation({ summary: 'Upload or replace a managed category image' })
  @ApiConsumes('multipart/form-data')
  @Post(':id/image')
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
  uploadCategoryImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: ProductImageUpload,
  ) {
    return this.catalogService.uploadCategoryImage(id, user.id, file);
  }

  @ApiOperation({ summary: 'Remove a managed or legacy category image' })
  @Delete(':id/image')
  deleteCategoryImage(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deleteCategoryImage(id);
  }

  @ApiOperation({ summary: 'Update a category as an admin' })
  @ApiParam({
    description: 'Category UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Category updated.', categoryDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Category was not found.',
      'CATEGORY_NOT_FOUND',
      'Category was not found.',
    ),
  )
  @Patch(':id')
  updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(id, dto);
  }

  @ApiOperation({ summary: 'Move a category up or down in storefront order' })
  @Patch(':id/reorder')
  reorderCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReorderCategoryDto,
  ) {
    return this.catalogService.reorderCategory(id, dto.direction);
  }

  @ApiOperation({ summary: 'Activate a category as an admin' })
  @Patch(':id/activate')
  activateCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.activateCategory(id);
  }

  @ApiOperation({ summary: 'Deactivate a category as an admin' })
  @ApiParam({
    description: 'Category UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Category deactivated.', categoryDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Category was not found.',
      'CATEGORY_NOT_FOUND',
      'Category was not found.',
    ),
  )
  @Patch(':id/deactivate')
  deactivateCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deactivateCategory(id);
  }

  @ApiOperation({ summary: 'Safely delete an empty category as an admin' })
  @Delete(':id')
  deleteCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deleteCategory(id);
  }
}
