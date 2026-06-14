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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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
  adminCategoryListDataExample,
  categoryDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { CatalogService } from './catalog.service';
import { AdminCategoryQueryDto } from './dto/admin-category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
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
  @Delete(':id')
  deactivateCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deactivateCategory(id);
  }
}
