import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ProductQueryDto } from './dto/product-query.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  listProducts(@Query() query: ProductQueryDto) {
    return this.catalogService.listProducts(query);
  }

  @Get(':id/variants')
  getProductVariants(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getPublicProductVariants(id);
  }

  @Get(':id')
  getProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getPublicProduct(id);
  }
}
