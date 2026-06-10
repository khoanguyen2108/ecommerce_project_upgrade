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
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(dto);
  }

  @Patch(':id')
  updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(id, dto);
  }

  @Delete(':id')
  deactivateCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogService.deactivateCategory(id);
  }
}
