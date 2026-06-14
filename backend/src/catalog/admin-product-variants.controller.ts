import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
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
  envelopeResponse,
  errorEnvelopeResponse,
  productVariantDataExample,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { CatalogService } from './catalog.service';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@ApiTags('product-variants')
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
@Controller('admin/product-variants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminProductVariantsController {
  constructor(private readonly catalogService: CatalogService) {}

  @ApiOperation({ summary: 'Get a product variant as an admin' })
  @ApiParam({
    description: 'Product variant UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Product variant returned.', productVariantDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product variant was not found.',
      'PRODUCT_VARIANT_NOT_FOUND',
      'Product variant was not found.',
    ),
  )
  @Get(':id')
  getProductVariant(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getAdminProductVariant(id);
  }

  @ApiOperation({ summary: 'Update a product variant as an admin' })
  @ApiParam({
    description: 'Product variant UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Product variant updated.', productVariantDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product variant was not found.',
      'PRODUCT_VARIANT_NOT_FOUND',
      'Product variant was not found.',
    ),
  )
  @Patch(':id')
  updateProductVariant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.catalogService.updateProductVariant(id, dto);
  }

  @ApiOperation({ summary: 'Deactivate a product variant as an admin' })
  @ApiParam({
    description: 'Product variant UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Product variant deactivated.', productVariantDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product variant was not found.',
      'PRODUCT_VARIANT_NOT_FOUND',
      'Product variant was not found.',
    ),
  )
  @Delete(':id')
  deactivateProductVariant(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deactivateProductVariant(id);
  }
}
