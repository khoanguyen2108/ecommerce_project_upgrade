import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { CatalogService } from './catalog.service';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@Controller('admin/product-variants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminProductVariantsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Patch(':id')
  updateProductVariant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.catalogService.updateProductVariant(id, dto);
  }

  @Delete(':id')
  deactivateProductVariant(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deactivateProductVariant(id);
  }
}
