import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: '../.env' });
config({ path: '.env' });

interface CategorySeed {
  name: string;
  slug: string;
  description: string;
}

interface VariantSeed {
  sku: string;
  size: string;
  color: string;
  stock: number;
  priceOverride?: number | null;
}

interface ProductSeed {
  categorySlug: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  imageText: string;
  variants: VariantSeed[];
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run prisma:seed.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

const categories: CategorySeed[] = [
  {
    name: 'Men',
    slug: 'men',
    description: 'Everyday menswear essentials.',
  },
  {
    name: 'Women',
    slug: 'women',
    description: 'Polished staples and casual layers.',
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Finishing pieces for daily outfits.',
  },
];

const imageUrl = (text: string) =>
  `https://placehold.co/900x1200/png?text=${encodeURIComponent(text)}`;

const products: ProductSeed[] = [
  {
    categorySlug: 'men',
    name: 'Relaxed Oxford Shirt',
    slug: 'relaxed-oxford-shirt',
    description: 'A crisp cotton shirt cut for everyday comfort.',
    basePrice: 390000,
    imageText: 'Relaxed Oxford Shirt',
    variants: [
      { sku: 'MEN-OXF-WHT-M', size: 'M', color: 'White', stock: 18 },
      { sku: 'MEN-OXF-WHT-L', size: 'L', color: 'White', stock: 14 },
      { sku: 'MEN-OXF-BLU-M', size: 'M', color: 'Blue', stock: 10 },
    ],
  },
  {
    categorySlug: 'men',
    name: 'Tapered Chino Pants',
    slug: 'tapered-chino-pants',
    description: 'Clean tapered chinos with a soft stretch finish.',
    basePrice: 520000,
    imageText: 'Tapered Chino Pants',
    variants: [
      { sku: 'MEN-CHI-KHK-30', size: '30', color: 'Khaki', stock: 9 },
      { sku: 'MEN-CHI-KHK-32', size: '32', color: 'Khaki', stock: 11 },
      { sku: 'MEN-CHI-BLK-32', size: '32', color: 'Black', stock: 8 },
    ],
  },
  {
    categorySlug: 'women',
    name: 'Linen Blend Midi Dress',
    slug: 'linen-blend-midi-dress',
    description: 'A breathable midi dress for warm-weather days.',
    basePrice: 680000,
    imageText: 'Linen Blend Midi Dress',
    variants: [
      { sku: 'WMN-LIN-CRM-S', size: 'S', color: 'Cream', stock: 7 },
      { sku: 'WMN-LIN-CRM-M', size: 'M', color: 'Cream', stock: 12 },
      { sku: 'WMN-LIN-NVY-M', size: 'M', color: 'Navy', stock: 6 },
    ],
  },
  {
    categorySlug: 'women',
    name: 'Ribbed Knit Tank',
    slug: 'ribbed-knit-tank',
    description: 'A fitted rib tank made for easy layering.',
    basePrice: 240000,
    imageText: 'Ribbed Knit Tank',
    variants: [
      { sku: 'WMN-RIB-BLK-S', size: 'S', color: 'Black', stock: 20 },
      { sku: 'WMN-RIB-BLK-M', size: 'M', color: 'Black', stock: 16 },
      { sku: 'WMN-RIB-SGE-M', size: 'M', color: 'Sage', stock: 13 },
    ],
  },
  {
    categorySlug: 'women',
    name: 'Cropped Denim Jacket',
    slug: 'cropped-denim-jacket',
    description: 'A structured denim layer with a cropped fit.',
    basePrice: 790000,
    imageText: 'Cropped Denim Jacket',
    variants: [
      { sku: 'WMN-DEN-LBL-S', size: 'S', color: 'Light Blue', stock: 5 },
      { sku: 'WMN-DEN-LBL-M', size: 'M', color: 'Light Blue', stock: 7 },
      { sku: 'WMN-DEN-IND-M', size: 'M', color: 'Indigo', stock: 4 },
    ],
  },
  {
    categorySlug: 'accessories',
    name: 'Canvas Tote Bag',
    slug: 'canvas-tote-bag',
    description: 'A sturdy canvas tote sized for daily errands.',
    basePrice: 190000,
    imageText: 'Canvas Tote Bag',
    variants: [
      { sku: 'ACC-TOTE-NAT-OS', size: 'OS', color: 'Natural', stock: 28 },
      { sku: 'ACC-TOTE-BLK-OS', size: 'OS', color: 'Black', stock: 21 },
    ],
  },
  {
    categorySlug: 'accessories',
    name: 'Minimal Leather Belt',
    slug: 'minimal-leather-belt',
    description: 'A simple leather belt with a brushed buckle.',
    basePrice: 310000,
    imageText: 'Minimal Leather Belt',
    variants: [
      { sku: 'ACC-BELT-BRN-M', size: 'M', color: 'Brown', stock: 10 },
      { sku: 'ACC-BELT-BRN-L', size: 'L', color: 'Brown', stock: 8 },
      { sku: 'ACC-BELT-BLK-M', size: 'M', color: 'Black', stock: 12 },
    ],
  },
];

async function main() {
  const categoryIdsBySlug = new Map<string, string>();

  for (const categorySeed of categories) {
    const category = await prisma.category.upsert({
      where: {
        slug: categorySeed.slug,
      },
      update: {
        name: categorySeed.name,
        description: categorySeed.description,
        isActive: true,
      },
      create: {
        name: categorySeed.name,
        slug: categorySeed.slug,
        description: categorySeed.description,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    categoryIdsBySlug.set(category.slug, category.id);
  }

  for (const productSeed of products) {
    const categoryId = categoryIdsBySlug.get(productSeed.categorySlug);

    if (!categoryId) {
      throw new Error(`Missing seed category: ${productSeed.categorySlug}`);
    }

    const product = await prisma.product.upsert({
      where: {
        slug: productSeed.slug,
      },
      update: {
        categoryId,
        name: productSeed.name,
        description: productSeed.description,
        basePrice: productSeed.basePrice,
        imageUrls: [imageUrl(productSeed.imageText)],
        isActive: true,
      },
      create: {
        categoryId,
        name: productSeed.name,
        slug: productSeed.slug,
        description: productSeed.description,
        basePrice: productSeed.basePrice,
        imageUrls: [imageUrl(productSeed.imageText)],
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    for (const variantSeed of productSeed.variants) {
      await prisma.productVariant.upsert({
        where: {
          productId_size_color: {
            productId: product.id,
            size: variantSeed.size,
            color: variantSeed.color,
          },
        },
        update: {
          sku: variantSeed.sku,
          stock: variantSeed.stock,
          priceOverride: variantSeed.priceOverride ?? null,
          isActive: true,
        },
        create: {
          productId: product.id,
          sku: variantSeed.sku,
          size: variantSeed.size,
          color: variantSeed.color,
          stock: variantSeed.stock,
          priceOverride: variantSeed.priceOverride ?? null,
          isActive: true,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
