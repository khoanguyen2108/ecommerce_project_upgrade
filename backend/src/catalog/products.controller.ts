import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  envelopeResponse,
  errorEnvelopeResponse,
  productDataExample,
  productListDataExample,
  productVariantsDataExample,
} from '../common/swagger/api-examples';
import { CatalogService } from './catalog.service';
import { ProductQueryDto } from './dto/product-query.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @ApiOperation({ summary: 'List active public products' })
  @ApiOkResponse(
    envelopeResponse('Active products returned.', productListDataExample),
  )
  @Get()
  listProducts(@Query() query: ProductQueryDto) {
    return this.catalogService.listProducts(query);
  }

  @ApiOperation({ summary: 'List active variants for an active product by slug' })
  @ApiParam({
    description: 'Product slug.',
    example: 'relaxed-oxford-shirt',
    name: 'slug',
  })
  @ApiOkResponse(
    envelopeResponse(
      'Active product variants returned.',
      productVariantsDataExample,
    ),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product was not found.',
      'PRODUCT_NOT_FOUND',
      'Product was not found.',
    ),
  )
  @Get('slug/:slug/variants')
  getProductVariantsBySlug(@Param('slug') slug: string) {
    return this.catalogService.getPublicProductVariantsBySlug(slug);
  }

  @ApiOperation({ summary: 'Get an active public product by slug' })
  @ApiParam({
    description: 'Product slug.',
    example: 'relaxed-oxford-shirt',
    name: 'slug',
  })
  @ApiOkResponse(
    envelopeResponse('Active product returned.', productDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product was not found.',
      'PRODUCT_NOT_FOUND',
      'Product was not found.',
    ),
  )
  @Get('slug/:slug')
  getProductBySlug(@Param('slug') slug: string) {
    return this.catalogService.getPublicProductBySlug(slug);
  }

  @ApiOperation({ summary: 'List active variants for an active product' })
  @ApiParam({
    description: 'Product UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse(
      'Active product variants returned.',
      productVariantsDataExample,
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
  getProductVariants(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getPublicProductVariants(id);
  }

  @ApiOperation({ summary: 'Get an active public product by ID' })
  @ApiParam({
    description: 'Product UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Active product returned.', productDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Product was not found.',
      'PRODUCT_NOT_FOUND',
      'Product was not found.',
    ),
  )
  @Get(':id')
  getProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getPublicProduct(id);
  }
}
