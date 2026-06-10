import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
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
  envelopeResponse,
  errorEnvelopeResponse,
  productDataExample,
  productVariantDataExample,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { CatalogService } from './catalog.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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

  @ApiOperation({ summary: 'Create a product as an admin' })
  @ApiCreatedResponse(
    envelopeResponse('Product created.', productDataExample),
  )
  @Post()
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(dto);
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
  @Delete(':id')
  deactivateProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deactivateProduct(id);
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
