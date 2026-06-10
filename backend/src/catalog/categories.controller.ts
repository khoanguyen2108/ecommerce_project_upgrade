import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  categoryDataExample,
  categoryListDataExample,
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { CatalogService } from './catalog.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @ApiOperation({ summary: 'List active public categories' })
  @ApiOkResponse(
    envelopeResponse('Active categories returned.', categoryListDataExample),
  )
  @Get()
  listCategories() {
    return this.catalogService.listCategories();
  }

  @ApiOperation({ summary: 'Get an active public category by ID' })
  @ApiParam({
    description: 'Category UUID.',
    name: 'id',
  })
  @ApiOkResponse(
    envelopeResponse('Active category returned.', categoryDataExample),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Category was not found.',
      'CATEGORY_NOT_FOUND',
      'Category was not found.',
    ),
  )
  @Get(':id')
  getCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.getPublicCategory(id);
  }
}
