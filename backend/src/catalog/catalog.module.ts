import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AuthModule } from '../auth/auth.module';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminProductVariantsController } from './admin-product-variants.controller';
import { AdminProductsController } from './admin-products.controller';
import { CatalogService } from './catalog.service';
import { CategoriesController } from './categories.controller';
import { ProductsController } from './products.controller';

@Module({
  imports: [AssetsModule, AuthModule],
  controllers: [
    CategoriesController,
    ProductsController,
    AdminCategoriesController,
    AdminProductsController,
    AdminProductVariantsController,
  ],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
