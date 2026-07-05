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
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
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
  envelopeResponse,
  errorEnvelopeResponse,
  productDataExample,
  productListDataExample,
  productVariantDataExample,
  productVariantListDataExample,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { CatalogService } from './catalog.service';
import { AdminProductQueryDto } from './dto/admin-product-query.dto';
import { AdminProductVariantQueryDto } from './dto/admin-product-variant-query.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';

@ApiTags('admin-products')
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
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @ApiOperation({ summary: 'List products as an admin' })
  @ApiOkResponse(
    envelopeResponse('Products returned.', productListDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'BAD_REQUEST',
      'minPrice must be less than or equal to maxPrice.',
    ),
  )
  @Get()
  listProducts(@Query() query: AdminProductQueryDto) {
    return this.catalogService.listAdminProducts(query);
  }

  @ApiOperation({
    summary: 'Get a product as an admin',
    description:
      'Includes the product category and all variants, including inactive variants.',
  })
  @ApiParam({
    description: 'Product UUID.',
    name: 'id',
  })
  @ApiOkResponse(envelopeResponse('Product returned.', productDataExample))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product was not found.',
      'PRODUCT_NOT_FOUND',
      'Product was not found.',
    ),
  )
  @Get(':id')
  getProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getAdminProduct(id);
  }

  @ApiOperation({
    summary: 'List product variants as an admin',
    description: 'Returns variants for a product, including inactive variants.',
  })
  @ApiParam({
    description: 'Product UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Product variants returned.', productVariantListDataExample),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Query validation failed.',
      'BAD_REQUEST',
      'stockStatus must be one of the following values: in_stock, low_stock, out_of_stock',
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product was not found.',
      'PRODUCT_NOT_FOUND',
      'Product was not found.',
    ),
  )
  @Get(':id/variants')
  listProductVariants(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: AdminProductVariantQueryDto,
  ) {
    return this.catalogService.listAdminProductVariants(id, query);
  }

  @ApiOperation({ summary: 'Create a product as an admin' })
  @ApiCreatedResponse(
    envelopeResponse('Product created.', productDataExample),
  )
  @Post()
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(dto);
  }

  @ApiOperation({ summary: 'Upload a managed product image as an admin' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ description: 'Product UUID.', name: 'id' })
  @Post(':id/images')
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
  uploadProductImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: ProductImageUpload,
  ) {
    return this.catalogService.uploadProductImage(id, user.id, file);
  }

  @ApiOperation({ summary: 'Reorder managed product images as an admin' })
  @ApiParam({ description: 'Product UUID.', name: 'id' })
  @Patch(':id/images/reorder')
  reorderProductImages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReorderProductImagesDto,
  ) {
    return this.catalogService.reorderProductImages(id, dto.imageIds);
  }

  @ApiOperation({ summary: 'Delete a managed product image as an admin' })
  @ApiParam({ description: 'Product UUID.', name: 'id' })
  @Delete(':id/images/:imageId')
  deleteProductImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
  ) {
    return this.catalogService.deleteProductImage(id, imageId);
  }

  @ApiOperation({ summary: 'Update a product as an admin' })
  @ApiParam({
    description: 'Product UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Product updated.', productDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product was not found.',
      'PRODUCT_NOT_FOUND',
      'Product was not found.',
    ),
  )
  @Patch(':id')
  updateProduct(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(id, dto);
  }

  @ApiOperation({ summary: 'Activate a product as an admin' })
  @Patch(':id/activate')
  activateProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.activateProduct(id);
  }

  @ApiOperation({ summary: 'Deactivate a product as an admin' })
  @ApiParam({
    description: 'Product UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Product deactivated.', productDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product was not found.',
      'PRODUCT_NOT_FOUND',
      'Product was not found.',
    ),
  )
  @Patch(':id/deactivate')
  deactivateProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deactivateProduct(id);
  }

  @ApiOperation({ summary: 'Safely delete an unreferenced product as an admin' })
  @Delete(':id')
  deleteProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deleteProduct(id);
  }

  @ApiOperation({ summary: 'Create a product variant as an admin' })
  @ApiParam({
    description: 'Product UUID.',
    name: 'id',
  })
  @ApiCreatedResponse(
    envelopeResponse('Product variant created.', productVariantDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product was not found.',
      'PRODUCT_NOT_FOUND',
      'Product was not found.',
    ),
  )
  @Post(':id/variants')
  createProductVariant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.catalogService.createProductVariant(id, dto);
  }
}
