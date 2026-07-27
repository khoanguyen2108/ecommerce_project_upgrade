import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: '../.env' });
config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run prisma:seed.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

const TOTAL = 50;

const firstNames = [
  'An',
  'Bao',
  'Chi',
  'Duy',
  'Giang',
  'Hana',
  'Khanh',
  'Linh',
  'Minh',
  'Nhi',
  'Phong',
  'Quyen',
  'Son',
  'Thao',
  'Trang',
  'Tuan',
  'Uyen',
  'Vy',
  'Yen',
  'Zane',
];
const lastNames = [
  'Nguyen',
  'Tran',
  'Le',
  'Pham',
  'Hoang',
  'Huynh',
  'Phan',
  'Vu',
  'Dang',
  'Bui',
  'Do',
  'Ho',
  'Ngo',
  'Duong',
  'Ly',
];
const productNouns = [
  'Linen Shirt',
  'Cropped Blazer',
  'Wide Leg Trousers',
  'Ribbed Tank',
  'Denim Jacket',
  'Pleated Skirt',
  'Relaxed Hoodie',
  'Tailored Vest',
  'Satin Dress',
  'Boxy Tee',
  'Cargo Pants',
  'Knit Cardigan',
  'Oxford Shirt',
  'Utility Shorts',
  'Wrap Top',
];
const productStyles = [
  'Aster',
  'Noir',
  'Solace',
  'Milan',
  'Rue',
  'Cedar',
  'Orchid',
  'Vale',
  'Muse',
  'Harbor',
];
const categoryNames = [
  'New Arrivals',
  'Office Staples',
  'Weekend Edit',
  'Evening Wear',
  'Minimal Basics',
  'Denim Studio',
  'Soft Tailoring',
  'Summer Linen',
  'Street Layers',
  'Resort Picks',
];
const sizes = ['XS', 'S', 'M', 'L', 'XL'];
const colors = ['Black', 'Ivory', 'Navy', 'Sage', 'Stone', 'Mocha', 'Rose', 'Sky'];
const provinces = ['Ho Chi Minh', 'Ha Noi', 'Da Nang', 'Can Tho', 'Binh Duong'];
const districts = ['District 1', 'District 3', 'District 7', 'Thu Duc', 'Cau Giay'];
const wards = ['Ben Nghe', 'Da Kao', 'Tan Dinh', 'An Phu', 'Thao Dien'];
const orderStatuses = ['PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED'] as const;
const fulfillmentStatuses = [
  'PENDING',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
] as const;
const returnStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
const issueTypes = [
  'LATE_PROVIDER_PAID',
  'PAID_AFTER_LOCAL_CANCELLED',
  'PAID_AFTER_LOCAL_EXPIRED',
  'PAID_STOCK_SHORTAGE',
  'PROVIDER_LOCAL_STATUS_MISMATCH',
] as const;
const issueStatuses = [
  'OPEN',
  'REVIEWING',
  'RESOLVED',
  'REFUND_REQUIRED',
  'REFUNDED',
  'FULFILLMENT_REQUIRED',
] as const;

const pad = (value: number) => value.toString().padStart(2, '0');
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const dateDaysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const dateDaysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const pick = <T>(values: readonly T[], index: number) => values[(index - 1) % values.length];
const fullName = (index: number) =>
  `${pick(lastNames, index)} ${pick(firstNames, index * 3)}`;
const imageUrl = (label: string, bg: string, fg = '111827') =>
  `https://placehold.co/900x1200/${bg}/${fg}/png?text=${encodeURIComponent(label)}`;

async function clearBusinessData() {
  await prisma.paymentReconciliationIssue.deleteMany();
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.returnRequest.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.savedOutfit.deleteMany();
  await prisma.passwordResetOtp.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.landingGalleryImage.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.landingPageSetting.deleteMany();
  await prisma.imageAsset.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearBusinessData();

  const users = [];
  const categories = [];
  const productAssets = [];
  const categoryAssets = [];
  const galleryAssets = [];
  const products = [];
  const variants = [];
  const vouchers = [];
  const orders = [];
  const payments = [];

  for (let index = 1; index <= TOTAL; index += 1) {
    const name = fullName(index);
    const emailName = `${pick(firstNames, index * 3)}.${pick(lastNames, index)}`.toLowerCase();

    users.push(
      await prisma.user.create({
        data: {
          email: `${emailName}${pad(index)}@belikeme.test`,
          passwordHash: '$2a$10$R9QfDk2M0xN8eA6zYpLzUu7B7Jq0U7q6n2HcM0sZ8oR1l4uS0eT2O',
          name,
          phone: `09${(12000000 + index * 7919).toString().slice(0, 8)}`,
          role: index <= 2 ? 'ADMIN' : index <= 7 ? 'STAFF' : 'CUSTOMER',
          authProvider: 'EMAIL',
          isActive: index % 17 !== 0,
          emailVerified: true,
        },
      }),
    );
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const uploader = pick(users, index);
    const label = `${pick(productStyles, index)} ${pick(productNouns, index * 2)}`;

    productAssets.push(
      await prisma.imageAsset.create({
        data: {
          provider: 'SUPABASE',
          bucket: 'catalog',
          storagePath: `products/${slugify(label)}-${pad(index)}.png`,
          publicUrl: imageUrl(label, 'f7f2ea'),
          originalFilename: `${slugify(label)}-${pad(index)}.png`,
          mimeType: 'image/png',
          sizeBytes: 140000 + index * 173,
          width: 900,
          height: 1200,
          checksum: `productchecksum${index.toString().padStart(49, '0')}`.slice(0, 64),
          uploadedById: uploader.id,
          status: 'ACTIVE',
        },
      }),
    );

    categoryAssets.push(
      await prisma.imageAsset.create({
        data: {
          provider: 'SUPABASE',
          bucket: 'catalog',
          storagePath: `categories/${slugify(pick(categoryNames, index))}-${pad(index)}.png`,
          publicUrl: imageUrl(pick(categoryNames, index), 'e8eefc'),
          originalFilename: `category-${pad(index)}.png`,
          mimeType: 'image/png',
          sizeBytes: 90000 + index * 97,
          width: 900,
          height: 1200,
          checksum: `categorychecksum${index.toString().padStart(48, '0')}`.slice(0, 64),
          uploadedById: uploader.id,
          status: 'ACTIVE',
        },
      }),
    );

    galleryAssets.push(
      await prisma.imageAsset.create({
        data: {
          provider: 'SUPABASE',
          bucket: 'landing',
          storagePath: `gallery/editorial-${pad(index)}.png`,
          publicUrl: imageUrl(`Editorial ${pad(index)}`, 'edf7f1'),
          originalFilename: `editorial-${pad(index)}.png`,
          mimeType: 'image/png',
          sizeBytes: 110000 + index * 113,
          width: 900,
          height: 1200,
          checksum: `gallerychecksum${index.toString().padStart(49, '0')}`.slice(0, 64),
          uploadedById: uploader.id,
          status: 'ACTIVE',
        },
      }),
    );
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const baseName = pick(categoryNames, index);
    const name = `${baseName} ${pad(index)}`;

    categories.push(
      await prisma.category.create({
        data: {
          name,
          slug: slugify(name),
          description: `Curated ${baseName.toLowerCase()} pieces for everyday styling.`,
          imageUrl: categoryAssets[index - 1].publicUrl,
          managedImageAssetId: categoryAssets[index - 1].id,
          isFeatured: index <= 10,
          featuredOrder: index <= 10 ? index : null,
          sortOrder: index,
          isActive: true,
        },
      }),
    );
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    await prisma.landingPageSetting.create({
      data: {
        id: index === 1 ? 'default' : `seasonal-${pad(index)}`,
        heroEyebrow: index === 1 ? 'BELIKEME' : `DROP ${pad(index)}`,
        heroTitle: index === 1 ? 'Fresh Looks For Every Day' : `${pick(productStyles, index)} Edit`,
        heroSubtitle: `A polished storefront setting for campaign ${pad(index)}.`,
        heroImageUrl: imageUrl(`Hero ${pad(index)}`, 'f1f5f9'),
      },
    });

    await prisma.landingGalleryImage.create({
      data: {
        imageUrl: galleryAssets[index - 1].publicUrl,
        managedImageAssetId: galleryAssets[index - 1].id,
        title: `${pick(productStyles, index)} Mood`,
        caption: `Editorial styling idea ${pad(index)} for the season.`,
        altText: `Belikeme editorial outfit ${pad(index)}`,
        sortOrder: index,
        isActive: true,
      },
    });
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const productName = `${pick(productStyles, index)} ${pick(productNouns, index * 2)} ${pad(index)}`;

    const product = await prisma.product.create({
      data: {
        categoryId: pick(categories, index).id,
        name: productName,
        slug: slugify(productName),
        description: `${productName} with clean lines, comfortable fabric, and versatile styling.`,
        basePrice: 180000 + index * 17000,
        imageUrls: [productAssets[index - 1].publicUrl],
        aiTags: [
          pick(['minimal', 'workwear', 'casual', 'evening', 'resort'], index),
          pick(['linen', 'denim', 'cotton', 'satin', 'knit'], index * 2),
        ],
        isActive: true,
      },
    });

    products.push(product);

    await prisma.productCategory.create({
      data: {
        productId: product.id,
        categoryId: pick(categories, index + 7).id,
      },
    });

    await prisma.productImage.create({
      data: {
        productId: product.id,
        imageAssetId: productAssets[index - 1].id,
        sortOrder: 1,
        isPrimary: true,
      },
    });
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const product = products[index - 1];
    const color = pick(colors, index * 3);
    const size = pick(sizes, index);

    variants.push(
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `BLK-${pad(index)}-${size}-${color.toUpperCase()}`,
          size,
          color,
          stock: 8 + ((index * 7) % 43),
          priceOverride: index % 4 === 0 ? product.basePrice + 35000 : null,
          isActive: true,
        },
      }),
    );
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    vouchers.push(
      await prisma.voucher.create({
        data: {
          code: `${pick(['STYLE', 'FRESH', 'VIP', 'NEW', 'WEEKEND'], index)}${(1000 + index).toString()}`,
          name: `${pick(['Style', 'Fresh', 'Member', 'Weekend', 'Launch'], index)} Reward ${pad(index)}`,
          description: `Promotion for qualified storefront orders ${pad(index)}.`,
          discountType: index % 2 === 0 ? 'PERCENT' : 'FIXED',
          discountValue: index % 2 === 0 ? 10 + (index % 4) * 5 : 25000 + index * 1000,
          minSubtotal: 150000,
          maxDiscount: index % 2 === 0 ? 75000 : null,
          usageLimit: 100 + index,
          perUserLimit: 2,
          startsAt: dateDaysAgo(20),
          endsAt: dateDaysFromNow(45),
          isActive: index % 13 !== 0,
        },
      }),
    );
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const user = users[index - 1];
    const variant = variants[index - 1];
    const product = products[index - 1];
    const province = pick(provinces, index);

    await prisma.address.create({
      data: {
        userId: user.id,
        recipientName: user.name ?? fullName(index),
        phone: user.phone ?? `091234${index.toString().padStart(4, '0')}`,
        province,
        district: pick(districts, index),
        ward: pick(wards, index * 2),
        addressLine: `${22 + index} ${pick(['Ly Tu Trong', 'Nguyen Hue', 'Pasteur', 'Nam Ky Khoi Nghia'], index)} Street`,
        note: index % 5 === 0 ? 'Call before delivery' : null,
        isDefault: true,
      },
    });

    await prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        email: user.email,
        otpHash: `otp${index.toString().padStart(61, '0')}`.slice(0, 64),
        expiresAt: dateDaysFromNow(1),
        usedAt: index % 3 === 0 ? dateDaysAgo(1) : null,
        attempts: index % 3,
      },
    });

    await prisma.savedOutfit.create({
      data: {
        userId: user.id,
        sourcePrompt: `Build a polished outfit for ${pick(['work', 'brunch', 'travel', 'date night'], index)}.`,
        locale: index % 2 === 0 ? 'vi' : 'en',
        summary: `${pick(productStyles, index)} outfit with ${product.name}.`,
        totalPriceSnapshot: product.basePrice,
        items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
      },
    });

    const cart = await prisma.cart.create({
      data: {
        userId: user.id,
      },
    });

    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        variantId: variant.id,
        quantity: (index % 3) + 1,
      },
    });

    const conversation = await prisma.chatConversation.create({
      data: {
        customerId: user.id,
        status: index % 6 === 0 ? 'CLOSED' : 'OPEN',
        lastMessageAt: dateDaysAgo(index),
      },
    });

    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        senderRole: 'CUSTOMER',
        body: `Hi, I need help checking the fit for order idea ${pad(index)}.`,
        messageType: 'text',
        metadata: { seed: true, topic: 'sizing' },
        readAt: index % 2 === 0 ? dateDaysAgo(index - 1) : null,
      },
    });
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const user = users[index - 1];
    const product = products[index - 1];
    const variant = variants[index - 1];
    const voucher = index % 2 === 0 ? vouchers[index - 1] : null;
    const status = pick(orderStatuses, index);
    const unitPrice = variant.priceOverride ?? product.basePrice;
    const quantity = (index % 3) + 1;
    const subtotalAmount = unitPrice * quantity;
    const discountAmount = voucher ? Math.min(70000, Math.floor(subtotalAmount * 0.12)) : 0;
    const totalAmount = subtotalAmount - discountAmount;
    const paidAt = status === 'PAID' ? dateDaysAgo(index) : null;

    const order = await prisma.order.create({
      data: {
        orderCode: `BK${(820000 + index).toString()}`,
        userId: user.id,
        status,
        fulfillmentStatus: pick(fulfillmentStatuses, index),
        subtotalAmount,
        discountAmount,
        totalAmount,
        voucherId: voucher?.id ?? null,
        voucherCodeSnapshot: voucher?.code ?? null,
        voucherNameSnapshot: voucher?.name ?? null,
        currency: 'VND',
        shippingRecipientName: user.name,
        shippingPhone: user.phone,
        shippingProvince: pick(provinces, index),
        shippingDistrict: pick(districts, index),
        shippingWard: pick(wards, index),
        shippingAddressLine: `${22 + index} ${pick(['Ly Tu Trong', 'Nguyen Hue', 'Pasteur', 'Nam Ky Khoi Nghia'], index)} Street`,
        shippingNote: index % 5 === 0 ? 'Call before delivery' : null,
        paidAt,
        fulfilledAt: status === 'PAID' && index % 3 === 0 ? dateDaysAgo(index - 1) : null,
        cancelledAt: status === 'CANCELLED' ? dateDaysAgo(index - 1) : null,
        expiresAt: status === 'PENDING_PAYMENT' ? dateDaysFromNow(1) : null,
      },
    });

    orders.push(order);

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        unitPrice,
        quantity,
        lineTotal: unitPrice * quantity,
      },
    });
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const order = orders[index - 1];
    const paymentStatus =
      order.status === 'PAID'
        ? 'PAID'
        : order.status === 'CANCELLED'
          ? 'CANCELLED'
          : order.status === 'EXPIRED'
            ? 'EXPIRED'
            : 'PENDING';

    payments.push(
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: 'PAYOS',
          status: paymentStatus,
          amount: order.totalAmount,
          currency: 'VND',
          providerOrderCode: 930000 + index,
          checkoutUrl: `https://pay.payos.vn/checkout/belikeme-${pad(index)}`,
          providerPaymentLinkId: `payos-link-${(930000 + index).toString()}`,
          providerTransactionReference:
            paymentStatus === 'PAID' ? `txn-${(740000 + index).toString()}` : null,
          failureReason: paymentStatus === 'EXPIRED' ? 'Payment link expired' : null,
          paidAt: paymentStatus === 'PAID' ? order.paidAt : null,
          cancelledAt: paymentStatus === 'CANCELLED' ? order.cancelledAt : null,
        },
      }),
    );
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const order = orders[index - 1];
    const payment = payments[index - 1];
    const customer = users[index - 1];
    const reviewer = pick(users, index + 2);
    const returnStatus = pick(returnStatuses, index);
    const issueStatus = pick(issueStatuses, index);

    await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        reason: pick(['WRONG_SIZE', 'DAMAGED_ITEM', 'COLOR_DIFFERENT', 'CHANGED_MIND'], index),
        description: `Customer requested a review for item fit or condition ${pad(index)}.`,
        status: returnStatus,
        reviewedAt: returnStatus === 'PENDING' ? null : dateDaysAgo(index - 1),
        reviewedBy: returnStatus === 'PENDING' ? null : reviewer.id,
      },
    });

    await prisma.paymentReconciliationIssue.create({
      data: {
        orderId: order.id,
        paymentId: payment.id,
        type: pick(issueTypes, index),
        status: issueStatus,
        provider: 'PAYOS',
        providerOrderCode: payment.providerOrderCode,
        providerPaymentLinkId: payment.providerPaymentLinkId,
        providerTransactionReference: payment.providerTransactionReference,
        amount: payment.amount,
        currency: payment.currency,
        safeReason: `Provider status needs manual review for payment ${pad(index)}.`,
        resolvedAt: ['RESOLVED', 'REFUNDED', 'FULFILLMENT_REQUIRED'].includes(issueStatus)
          ? dateDaysAgo(index - 1)
          : null,
        resolvedBy: ['RESOLVED', 'REFUNDED', 'FULFILLMENT_REQUIRED'].includes(issueStatus)
          ? reviewer.id
          : null,
        adminNote: `Operations note ${pad(index)}`,
      },
    });

    await prisma.paymentWebhookEvent.create({
      data: {
        provider: 'PAYOS',
        eventKey: `payos.order.${(930000 + index).toString()}.updated`,
        signatureHash: `sig${index.toString().padStart(61, '0')}`.slice(0, 64),
        paymentId: payment.id,
        orderId: order.id,
        receivedAt: dateDaysAgo(index),
        processedAt: dateDaysAgo(index - 1),
        processingStatus: index % 8 === 0 ? 'RETRYING' : 'PROCESSED',
        metadata: {
          orderCode: order.orderCode,
          providerOrderCode: payment.providerOrderCode,
          status: payment.status,
        },
      },
    });
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
