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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { CatalogService } from './catalog.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(dto);
  }

  @Patch(':id')
  updateProduct(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(id, dto);
  }

  @Delete(':id')
  deactivateProduct(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deactivateProduct(id);
  }

  @Post(':id/variants')
  createProductVariant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.catalogService.createProductVariant(id, dto);
  }
}
