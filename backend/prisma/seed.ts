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
  imageUrls: string[];
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
    description: 'Tailored everyday staples for menswear wardrobes.',
  },
  {
    name: 'Women',
    slug: 'women',
    description: 'Easy polished pieces for workdays, weekends, and travel.',
  },
  {
    name: 'Tops',
    slug: 'tops',
    description: 'Tees, shirts, tanks, and light knit layers.',
  },
  {
    name: 'Bottoms',
    slug: 'bottoms',
    description: 'Trousers, skirts, chinos, and everyday separates.',
  },
  {
    name: 'Outerwear',
    slug: 'outerwear',
    description: 'Light jackets, overshirts, and soft seasonal layers.',
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Finishing pieces for daily outfits.',
  },
];

const demoImage = (text: string, background: string, foreground = '111827') =>
  `https://placehold.co/900x1200/${background}/${foreground}/png?text=${encodeURIComponent(text)}`;

const products: ProductSeed[] = [
  {
    categorySlug: 'men',
    name: 'Relaxed Oxford Shirt',
    slug: 'relaxed-oxford-shirt',
    description:
      'A crisp cotton oxford with a relaxed cut, button-down collar, and softly washed finish.',
    basePrice: 390000,
    imageUrls: [
      demoImage('Relaxed Oxford Shirt', 'f8fafc'),
      demoImage('Blue Oxford Detail', 'dbeafe', '0f172a'),
    ],
    variants: [
      { sku: 'MEN-OXF-WHT-S', size: 'S', color: 'White', stock: 12 },
      { sku: 'MEN-OXF-WHT-M', size: 'M', color: 'White', stock: 18 },
      { sku: 'MEN-OXF-WHT-L', size: 'L', color: 'White', stock: 14 },
      { sku: 'MEN-OXF-WHT-XL', size: 'XL', color: 'White', stock: 8 },
      { sku: 'MEN-OXF-BLU-M', size: 'M', color: 'Blue', stock: 10 },
      { sku: 'MEN-OXF-BLU-L', size: 'L', color: 'Blue', stock: 9 },
    ],
  },
  {
    categorySlug: 'men',
    name: 'Tapered Chino Pants',
    slug: 'tapered-chino-pants',
    description:
      'Clean tapered chinos in a compact stretch twill with a weekday-to-weekend fit.',
    basePrice: 520000,
    imageUrls: [
      demoImage('Tapered Chino Pants', 'e7e5e4'),
      demoImage('Chino Fit Detail', 'd6d3d1'),
    ],
    variants: [
      { sku: 'MEN-CHI-KHK-30', size: '30', color: 'Khaki', stock: 9 },
      { sku: 'MEN-CHI-KHK-32', size: '32', color: 'Khaki', stock: 11 },
      { sku: 'MEN-CHI-KHK-34', size: '34', color: 'Khaki', stock: 7 },
      { sku: 'MEN-CHI-BLK-30', size: '30', color: 'Black', stock: 6 },
      { sku: 'MEN-CHI-BLK-32', size: '32', color: 'Black', stock: 8 },
    ],
  },
  {
    categorySlug: 'women',
    name: 'Linen Blend Midi Dress',
    slug: 'linen-blend-midi-dress',
    description:
      'A breathable linen-blend midi dress with a square neckline, side pockets, and easy drape.',
    basePrice: 680000,
    imageUrls: [
      demoImage('Linen Blend Midi Dress', 'fff7ed'),
      demoImage('Navy Midi Dress', 'dbeafe', '0f172a'),
    ],
    variants: [
      { sku: 'WMN-LIN-CRM-XS', size: 'XS', color: 'Cream', stock: 5 },
      { sku: 'WMN-LIN-CRM-S', size: 'S', color: 'Cream', stock: 7 },
      { sku: 'WMN-LIN-CRM-M', size: 'M', color: 'Cream', stock: 12 },
      { sku: 'WMN-LIN-NVY-M', size: 'M', color: 'Navy', stock: 6 },
      { sku: 'WMN-LIN-NVY-L', size: 'L', color: 'Navy', stock: 4 },
    ],
  },
  {
    categorySlug: 'tops',
    name: 'Ribbed Knit Tank',
    slug: 'ribbed-knit-tank',
    description:
      'A fitted ribbed tank in a soft cotton blend, made for layering or wearing solo.',
    basePrice: 240000,
    imageUrls: [
      demoImage('Ribbed Knit Tank', 'f3f4f6'),
      demoImage('Sage Ribbed Tank', 'dcfce7', '14532d'),
    ],
    variants: [
      { sku: 'WMN-RIB-BLK-XS', size: 'XS', color: 'Black', stock: 11 },
      { sku: 'WMN-RIB-BLK-S', size: 'S', color: 'Black', stock: 20 },
      { sku: 'WMN-RIB-BLK-M', size: 'M', color: 'Black', stock: 16 },
      { sku: 'WMN-RIB-SGE-M', size: 'M', color: 'Sage', stock: 13 },
      { sku: 'WMN-RIB-SGE-L', size: 'L', color: 'Sage', stock: 8 },
    ],
  },
  {
    categorySlug: 'outerwear',
    name: 'Cropped Denim Jacket',
    slug: 'cropped-denim-jacket',
    description:
      'A structured cropped denim jacket with easy sleeves and a vintage-inspired wash.',
    basePrice: 790000,
    imageUrls: [
      demoImage('Cropped Denim Jacket', 'dbeafe', '0f172a'),
      demoImage('Indigo Denim Jacket', 'c7d2fe', '1e1b4b'),
    ],
    variants: [
      { sku: 'WMN-DEN-LBL-S', size: 'S', color: 'Light Blue', stock: 5 },
      { sku: 'WMN-DEN-LBL-M', size: 'M', color: 'Light Blue', stock: 7 },
      { sku: 'WMN-DEN-IND-M', size: 'M', color: 'Indigo', stock: 4 },
      { sku: 'WMN-DEN-IND-L', size: 'L', color: 'Indigo', stock: 5 },
    ],
  },
  {
    categorySlug: 'accessories',
    name: 'Canvas Tote Bag',
    slug: 'canvas-tote-bag',
    description:
      'A sturdy recycled-canvas tote with interior pocketing and reinforced handles.',
    basePrice: 190000,
    imageUrls: [
      demoImage('Canvas Tote Bag', 'f5f5f4'),
      demoImage('Black Canvas Tote', 'e5e7eb'),
    ],
    variants: [
      { sku: 'ACC-TOTE-NAT-OS', size: 'OS', color: 'Natural', stock: 28 },
      { sku: 'ACC-TOTE-BLK-OS', size: 'OS', color: 'Black', stock: 21 },
      { sku: 'ACC-TOTE-OLV-OS', size: 'OS', color: 'Olive', stock: 15 },
    ],
  },
  {
    categorySlug: 'accessories',
    name: 'Minimal Leather Belt',
    slug: 'minimal-leather-belt',
    description:
      'A minimal leather belt with a brushed metal buckle and clean stitched edges.',
    basePrice: 310000,
    imageUrls: [
      demoImage('Minimal Leather Belt', 'ede9fe', '1f2937'),
      demoImage('Black Leather Belt', 'e5e7eb'),
    ],
    variants: [
      { sku: 'ACC-BELT-BRN-S', size: 'S', color: 'Brown', stock: 7 },
      { sku: 'ACC-BELT-BRN-M', size: 'M', color: 'Brown', stock: 10 },
      { sku: 'ACC-BELT-BRN-L', size: 'L', color: 'Brown', stock: 8 },
      { sku: 'ACC-BELT-BLK-M', size: 'M', color: 'Black', stock: 12 },
      { sku: 'ACC-BELT-BLK-L', size: 'L', color: 'Black', stock: 9 },
    ],
  },
  {
    categorySlug: 'tops',
    name: 'Boxy Heavyweight Tee',
    slug: 'boxy-heavyweight-tee',
    description:
      'A boxy heavyweight cotton tee with dropped shoulders and a durable rib collar.',
    basePrice: 260000,
    imageUrls: [
      demoImage('Boxy Heavyweight Tee', 'f9fafb'),
      demoImage('Washed Black Tee', 'e5e7eb'),
    ],
    variants: [
      { sku: 'TOP-BOX-WHT-S', size: 'S', color: 'White', stock: 16 },
      { sku: 'TOP-BOX-WHT-M', size: 'M', color: 'White', stock: 22 },
      { sku: 'TOP-BOX-WHT-L', size: 'L', color: 'White', stock: 18 },
      { sku: 'TOP-BOX-WBK-M', size: 'M', color: 'Washed Black', stock: 14 },
      { sku: 'TOP-BOX-WBK-L', size: 'L', color: 'Washed Black', stock: 13 },
      { sku: 'TOP-BOX-WBK-XL', size: 'XL', color: 'Washed Black', stock: 8 },
    ],
  },
  {
    categorySlug: 'bottoms',
    name: 'Pleated Wide-Leg Trousers',
    slug: 'pleated-wide-leg-trousers',
    description:
      'Fluid wide-leg trousers with front pleats, a high rise, and a softly tailored fall.',
    basePrice: 620000,
    imageUrls: [
      demoImage('Wide-Leg Trousers', 'f4f4f5'),
      demoImage('Stone Pleated Trouser', 'e7e5e4'),
    ],
    variants: [
      { sku: 'BOT-PLT-STN-S', size: 'S', color: 'Stone', stock: 8 },
      { sku: 'BOT-PLT-STN-M', size: 'M', color: 'Stone', stock: 10 },
      { sku: 'BOT-PLT-STN-L', size: 'L', color: 'Stone', stock: 7 },
      { sku: 'BOT-PLT-CHR-M', size: 'M', color: 'Charcoal', stock: 9 },
      { sku: 'BOT-PLT-CHR-L', size: 'L', color: 'Charcoal', stock: 6 },
    ],
  },
  {
    categorySlug: 'outerwear',
    name: 'Lightweight Utility Overshirt',
    slug: 'lightweight-utility-overshirt',
    description:
      'A lightweight cotton overshirt with utility pockets and enough room for layering.',
    basePrice: 590000,
    imageUrls: [
      demoImage('Utility Overshirt', 'ecfccb', '1f2937'),
      demoImage('Navy Utility Overshirt', 'dbeafe', '172554'),
    ],
    variants: [
      { sku: 'OUT-UTL-OLV-S', size: 'S', color: 'Olive', stock: 9 },
      { sku: 'OUT-UTL-OLV-M', size: 'M', color: 'Olive', stock: 13 },
      { sku: 'OUT-UTL-OLV-L', size: 'L', color: 'Olive', stock: 10 },
      { sku: 'OUT-UTL-NVY-M', size: 'M', color: 'Navy', stock: 7 },
      { sku: 'OUT-UTL-NVY-XL', size: 'XL', color: 'Navy', stock: 5 },
    ],
  },
  {
    categorySlug: 'bottoms',
    name: 'Satin Slip Skirt',
    slug: 'satin-slip-skirt',
    description:
      'A bias-cut satin skirt with an elastic waistband and a smooth midi-length silhouette.',
    basePrice: 450000,
    imageUrls: [
      demoImage('Satin Slip Skirt', 'fdf2f8', '831843'),
      demoImage('Black Slip Skirt', 'e5e7eb'),
    ],
    variants: [
      { sku: 'BOT-SLP-CHA-S', size: 'S', color: 'Champagne', stock: 7 },
      { sku: 'BOT-SLP-CHA-M', size: 'M', color: 'Champagne', stock: 8 },
      { sku: 'BOT-SLP-CHA-L', size: 'L', color: 'Champagne', stock: 5 },
      { sku: 'BOT-SLP-BLK-S', size: 'S', color: 'Black', stock: 9 },
      { sku: 'BOT-SLP-BLK-M', size: 'M', color: 'Black', stock: 11 },
    ],
  },
  {
    categorySlug: 'outerwear',
    name: 'Soft Knit Cardigan',
    slug: 'soft-knit-cardigan',
    description:
      'A soft midweight cardigan with a relaxed V-neck, rib trims, and corozo-style buttons.',
    basePrice: 540000,
    imageUrls: [
      demoImage('Soft Knit Cardigan', 'fefce8', '713f12'),
      demoImage('Forest Knit Cardigan', 'dcfce7', '14532d'),
    ],
    variants: [
      { sku: 'OUT-CAR-OAT-S', size: 'S', color: 'Oatmeal', stock: 10 },
      { sku: 'OUT-CAR-OAT-M', size: 'M', color: 'Oatmeal', stock: 14 },
      { sku: 'OUT-CAR-OAT-L', size: 'L', color: 'Oatmeal', stock: 9 },
      { sku: 'OUT-CAR-FOR-M', size: 'M', color: 'Forest', stock: 8 },
      { sku: 'OUT-CAR-FOR-XL', size: 'XL', color: 'Forest', stock: 4 },
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
        imageUrls: productSeed.imageUrls,
        isActive: true,
      },
      create: {
        categoryId,
        name: productSeed.name,
        slug: productSeed.slug,
        description: productSeed.description,
        basePrice: productSeed.basePrice,
        imageUrls: productSeed.imageUrls,
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
