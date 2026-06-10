import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get(':id')
  getCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getPublicCategory(id);
  }
}
