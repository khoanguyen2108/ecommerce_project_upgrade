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
const sizes = ['XS', 'S', 'M', 'L', 'XL'];
const colors = ['Black', 'White', 'Navy', 'Sage', 'Stone'];
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
const dateDaysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const demoImage = (text: string, background: string, foreground = '111827') =>
  `https://placehold.co/900x1200/${background}/${foreground}/png?text=${encodeURIComponent(text)}`;

async function main() {
  const users = [];
  const categories = [];
  const products = [];
  const variants = [];
  const vouchers = [];
  const imageAssets = [];
  const carts = [];
  const orders = [];
  const payments = [];

  await prisma.landingPageSetting.upsert({
    where: { id: 'default' },
    update: {
      heroEyebrow: 'BELIKEME Demo',
      heroTitle: 'Seed storefront data',
      heroSubtitle: 'Demo products, customers, orders, and payments.',
      heroImageUrl: '/images/landing/hero.jpg',
    },
    create: {
      id: 'default',
      heroEyebrow: 'BELIKEME Demo',
      heroTitle: 'Seed storefront data',
      heroSubtitle: 'Demo products, customers, orders, and payments.',
      heroImageUrl: '/images/landing/hero.jpg',
    },
  });

  for (let index = 1; index <= TOTAL; index += 1) {
    const user = await prisma.user.upsert({
      where: { email: `customer${pad(index)}@gmail.com` },
      update: {
        name: `Customer ${pad(index)}`,
        phone: `090000${index.toString().padStart(4, '0')}`,
        role: index <= 3 ? 'ADMIN' : index <= 8 ? 'STAFF' : 'CUSTOMER',
        isActive: true,
        emailVerified: true,
      },
      create: {
        email: `customer${pad(index)}@gmail.com`,
        passwordHash: '$2a$10$seeded.demo.password.hash.only',
        name: `Customer ${pad(index)}`,
        phone: `090000${index.toString().padStart(4, '0')}`,
        role: index <= 3 ? 'ADMIN' : index <= 8 ? 'STAFF' : 'CUSTOMER',
        authProvider: 'EMAIL',
        isActive: true,
        emailVerified: true,
      },
    });

    users.push(user);
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const category = await prisma.category.upsert({
      where: { slug: `seed-category-${pad(index)}` },
      update: {
        name: `Seed Category ${pad(index)}`,
        description: `Demo category number ${pad(index)}.`,
        imageUrl: demoImage(`Category ${pad(index)}`, 'f3f4f6'),
        sortOrder: index,
        isActive: true,
        isFeatured: false,
        featuredOrder: null,
      },
      create: {
        name: `Seed Category ${pad(index)}`,
        slug: `seed-category-${pad(index)}`,
        description: `Demo category number ${pad(index)}.`,
        imageUrl: demoImage(`Category ${pad(index)}`, 'f3f4f6'),
        sortOrder: index,
        isActive: true,
        isFeatured: false,
        featuredOrder: null,
      },
    });

    categories.push(category);
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const uploader = users[(index - 1) % users.length];
    const imageAsset = await prisma.imageAsset.upsert({
      where: {
        provider_bucket_storagePath: {
          provider: 'SUPABASE',
          bucket: 'seed-assets',
          storagePath: `products/seed-product-${pad(index)}.png`,
        },
      },
      update: {
        publicUrl: demoImage(`Product ${pad(index)}`, 'f8fafc'),
        originalFilename: `seed-product-${pad(index)}.png`,
        mimeType: 'image/png',
        sizeBytes: 120000 + index,
        width: 900,
        height: 1200,
        uploadedById: uploader.id,
        status: 'ACTIVE',
      },
      create: {
        provider: 'SUPABASE',
        bucket: 'seed-assets',
        storagePath: `products/seed-product-${pad(index)}.png`,
        publicUrl: demoImage(`Product ${pad(index)}`, 'f8fafc'),
        originalFilename: `seed-product-${pad(index)}.png`,
        mimeType: 'image/png',
        sizeBytes: 120000 + index,
        width: 900,
        height: 1200,
        uploadedById: uploader.id,
        status: 'ACTIVE',
      },
    });

    imageAssets.push(imageAsset);
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const category = categories[(index - 1) % categories.length];
    const product = await prisma.product.upsert({
      where: { slug: `seed-product-${pad(index)}` },
      update: {
        categoryId: category.id,
        name: `Seed Product ${pad(index)}`,
        description: `Demo product ${pad(index)} for storefront testing.`,
        basePrice: 150000 + index * 10000,
        imageUrls: [demoImage(`Product ${pad(index)}`, 'f8fafc')],
        aiTags: ['demo', `style-${(index % 5) + 1}`],
        isActive: true,
      },
      create: {
        categoryId: category.id,
        name: `Seed Product ${pad(index)}`,
        slug: `seed-product-${pad(index)}`,
        description: `Demo product ${pad(index)} for storefront testing.`,
        basePrice: 150000 + index * 10000,
        imageUrls: [demoImage(`Product ${pad(index)}`, 'f8fafc')],
        aiTags: ['demo', `style-${(index % 5) + 1}`],
        isActive: true,
      },
    });

    products.push(product);

    await prisma.productCategory.upsert({
      where: {
        productId_categoryId: {
          productId: product.id,
          categoryId: categories[index % categories.length].id,
        },
      },
      update: {},
      create: {
        productId: product.id,
        categoryId: categories[index % categories.length].id,
      },
    });

    await prisma.productImage.upsert({
      where: { imageAssetId: imageAssets[index - 1].id },
      update: {
        productId: product.id,
        sortOrder: 1,
        isPrimary: true,
      },
      create: {
        productId: product.id,
        imageAssetId: imageAssets[index - 1].id,
        sortOrder: 1,
        isPrimary: true,
      },
    });
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const product = products[(index - 1) % products.length];
    const variant = await prisma.productVariant.upsert({
      where: {
        productId_size_color: {
          productId: product.id,
          size: sizes[(index - 1) % sizes.length],
          color: colors[(index - 1) % colors.length],
        },
      },
      update: {
        sku: `SEED-SKU-${pad(index)}`,
        stock: 5 + index,
        priceOverride: index % 4 === 0 ? product.basePrice + 25000 : null,
        isActive: true,
      },
      create: {
        productId: product.id,
        sku: `SEED-SKU-${pad(index)}`,
        size: sizes[(index - 1) % sizes.length],
        color: colors[(index - 1) % colors.length],
        stock: 5 + index,
        priceOverride: index % 4 === 0 ? product.basePrice + 25000 : null,
        isActive: true,
      },
    });

    variants.push(variant);
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const voucher = await prisma.voucher.upsert({
      where: { code: `SEED${pad(index)}` },
      update: {
        name: `Seed Voucher ${pad(index)}`,
        description: `Demo voucher ${pad(index)}.`,
        discountType: index % 2 === 0 ? 'PERCENT' : 'FIXED',
        discountValue: index % 2 === 0 ? 10 : 30000,
        minSubtotal: 100000,
        maxDiscount: index % 2 === 0 ? 50000 : null,
        usageLimit: 100,
        perUserLimit: 2,
        startsAt: dateDaysAgo(30),
        endsAt: dateDaysAgo(-30),
        isActive: true,
      },
      create: {
        code: `SEED${pad(index)}`,
        name: `Seed Voucher ${pad(index)}`,
        description: `Demo voucher ${pad(index)}.`,
        discountType: index % 2 === 0 ? 'PERCENT' : 'FIXED',
        discountValue: index % 2 === 0 ? 10 : 30000,
        minSubtotal: 100000,
        maxDiscount: index % 2 === 0 ? 50000 : null,
        usageLimit: 100,
        perUserLimit: 2,
        startsAt: dateDaysAgo(30),
        endsAt: dateDaysAgo(-30),
        isActive: true,
      },
    });

    vouchers.push(voucher);
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const user = users[index - 1];
    const variant = variants[(index - 1) % variants.length];
    const product = products[(index - 1) % products.length];

    await prisma.address.upsert({
      where: { id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}` },
      update: {
        userId: user.id,
        recipientName: user.name ?? `Customer ${pad(index)}`,
        phone: user.phone ?? `090000${index.toString().padStart(4, '0')}`,
        province: 'Ho Chi Minh',
        district: `District ${(index % 12) + 1}`,
        ward: `Ward ${(index % 20) + 1}`,
        addressLine: `${index} Seed Street`,
        note: `Seed address ${pad(index)}`,
        isDefault: true,
      },
      create: {
        id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
        userId: user.id,
        recipientName: user.name ?? `Customer ${pad(index)}`,
        phone: user.phone ?? `090000${index.toString().padStart(4, '0')}`,
        province: 'Ho Chi Minh',
        district: `District ${(index % 12) + 1}`,
        ward: `Ward ${(index % 20) + 1}`,
        addressLine: `${index} Seed Street`,
        note: `Seed address ${pad(index)}`,
        isDefault: true,
      },
    });

    await prisma.passwordResetOtp.upsert({
      where: { id: `00000000-0000-4001-8000-${index.toString().padStart(12, '0')}` },
      update: {
        userId: user.id,
        email: user.email,
        otpHash: `seedhash${index.toString().padStart(56, '0')}`.slice(0, 64),
        expiresAt: dateDaysAgo(-1),
        usedAt: index % 2 === 0 ? dateDaysAgo(1) : null,
        attempts: index % 3,
      },
      create: {
        id: `00000000-0000-4001-8000-${index.toString().padStart(12, '0')}`,
        userId: user.id,
        email: user.email,
        otpHash: `seedhash${index.toString().padStart(56, '0')}`.slice(0, 64),
        expiresAt: dateDaysAgo(-1),
        usedAt: index % 2 === 0 ? dateDaysAgo(1) : null,
        attempts: index % 3,
      },
    });

    await prisma.savedOutfit.upsert({
      where: { id: `00000000-0000-4002-8000-${index.toString().padStart(12, '0')}` },
      update: {
        userId: user.id,
        sourcePrompt: `Demo outfit prompt ${pad(index)}`,
        locale: index % 2 === 0 ? 'vi' : 'en',
        summary: `Seed outfit ${pad(index)}`,
        totalPriceSnapshot: product.basePrice,
        items: [{ productId: product.id, variantId: variant.id, role: 'top' }],
      },
      create: {
        id: `00000000-0000-4002-8000-${index.toString().padStart(12, '0')}`,
        userId: user.id,
        sourcePrompt: `Demo outfit prompt ${pad(index)}`,
        locale: index % 2 === 0 ? 'vi' : 'en',
        summary: `Seed outfit ${pad(index)}`,
        totalPriceSnapshot: product.basePrice,
        items: [{ productId: product.id, variantId: variant.id, role: 'top' }],
      },
    });

    const cart = await prisma.cart.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    carts.push(cart);

    await prisma.cartItem.upsert({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: variant.id,
        },
      },
      update: { quantity: (index % 3) + 1 },
      create: {
        cartId: cart.id,
        variantId: variant.id,
        quantity: (index % 3) + 1,
      },
    });

    const conversation = await prisma.chatConversation.upsert({
      where: { id: `00000000-0000-4003-8000-${index.toString().padStart(12, '0')}` },
      update: {
        customerId: user.id,
        status: index % 4 === 0 ? 'CLOSED' : 'OPEN',
        lastMessageAt: dateDaysAgo(index),
      },
      create: {
        id: `00000000-0000-4003-8000-${index.toString().padStart(12, '0')}`,
        customerId: user.id,
        status: index % 4 === 0 ? 'CLOSED' : 'OPEN',
        lastMessageAt: dateDaysAgo(index),
      },
    });

    await prisma.chatMessage.upsert({
      where: { id: `00000000-0000-4004-8000-${index.toString().padStart(12, '0')}` },
      update: {
        conversationId: conversation.id,
        senderId: user.id,
        senderRole: 'CUSTOMER',
        body: `Seed chat message ${pad(index)}`,
        readAt: index % 2 === 0 ? dateDaysAgo(index - 1) : null,
      },
      create: {
        id: `00000000-0000-4004-8000-${index.toString().padStart(12, '0')}`,
        conversationId: conversation.id,
        senderId: user.id,
        senderRole: 'CUSTOMER',
        body: `Seed chat message ${pad(index)}`,
        readAt: index % 2 === 0 ? dateDaysAgo(index - 1) : null,
      },
    });
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const user = users[(index - 1) % users.length];
    const product = products[(index - 1) % products.length];
    const variant = variants[(index - 1) % variants.length];
    const voucher = vouchers[(index - 1) % vouchers.length];
    const status = orderStatuses[(index - 1) % orderStatuses.length];
    const unitPrice = variant.priceOverride ?? product.basePrice;
    const quantity = (index % 3) + 1;
    const subtotalAmount = unitPrice * quantity;
    const discountAmount = index % 2 === 0 ? 20000 : 0;
    const totalAmount = subtotalAmount - discountAmount;
    const paidAt = status === 'PAID' ? dateDaysAgo(index) : null;

    const order = await prisma.order.upsert({
      where: { orderCode: `BK9${index.toString().padStart(5, '0')}` },
      update: {
        userId: user.id,
        status,
        fulfillmentStatus: fulfillmentStatuses[(index - 1) % fulfillmentStatuses.length],
        subtotalAmount,
        discountAmount,
        totalAmount,
        voucherId: index % 2 === 0 ? voucher.id : null,
        voucherCodeSnapshot: index % 2 === 0 ? voucher.code : null,
        voucherNameSnapshot: index % 2 === 0 ? voucher.name : null,
        paidAt,
        fulfilledAt: status === 'PAID' && index % 3 === 0 ? dateDaysAgo(index - 1) : null,
        cancelledAt: status === 'CANCELLED' ? dateDaysAgo(index - 1) : null,
        expiresAt: status === 'PENDING_PAYMENT' ? dateDaysAgo(-1) : null,
        shippingRecipientName: user.name,
        shippingPhone: user.phone,
        shippingProvince: 'Ho Chi Minh',
        shippingDistrict: `District ${(index % 12) + 1}`,
        shippingWard: `Ward ${(index % 20) + 1}`,
        shippingAddressLine: `${index} Seed Street`,
      },
      create: {
        orderCode: `BK9${index.toString().padStart(5, '0')}`,
        userId: user.id,
        status,
        fulfillmentStatus: fulfillmentStatuses[(index - 1) % fulfillmentStatuses.length],
        subtotalAmount,
        discountAmount,
        totalAmount,
        voucherId: index % 2 === 0 ? voucher.id : null,
        voucherCodeSnapshot: index % 2 === 0 ? voucher.code : null,
        voucherNameSnapshot: index % 2 === 0 ? voucher.name : null,
        paidAt,
        fulfilledAt: status === 'PAID' && index % 3 === 0 ? dateDaysAgo(index - 1) : null,
        cancelledAt: status === 'CANCELLED' ? dateDaysAgo(index - 1) : null,
        expiresAt: status === 'PENDING_PAYMENT' ? dateDaysAgo(-1) : null,
        shippingRecipientName: user.name,
        shippingPhone: user.phone,
        shippingProvince: 'Ho Chi Minh',
        shippingDistrict: `District ${(index % 12) + 1}`,
        shippingWard: `Ward ${(index % 20) + 1}`,
        shippingAddressLine: `${index} Seed Street`,
      },
    });

    orders.push(order);

    await prisma.orderItem.upsert({
      where: { id: `00000000-0000-4005-8000-${index.toString().padStart(12, '0')}` },
      update: {
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
      create: {
        id: `00000000-0000-4005-8000-${index.toString().padStart(12, '0')}`,
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

    const payment = await prisma.payment.upsert({
      where: {
        orderId_provider: {
          orderId: order.id,
          provider: 'PAYOS',
        },
      },
      update: {
        status: paymentStatus,
        amount: order.totalAmount,
        providerOrderCode: 900000 + index,
        checkoutUrl: `https://pay.payos.vn/seed-${pad(index)}`,
        providerPaymentLinkId: `seed-payment-link-${pad(index)}`,
        providerTransactionReference:
          paymentStatus === 'PAID' ? `seed-txn-${pad(index)}` : null,
        failureReason: null,
        paidAt: paymentStatus === 'PAID' ? order.paidAt : null,
        cancelledAt: paymentStatus === 'CANCELLED' ? order.cancelledAt : null,
      },
      create: {
        orderId: order.id,
        provider: 'PAYOS',
        status: paymentStatus,
        amount: order.totalAmount,
        providerOrderCode: 900000 + index,
        checkoutUrl: `https://pay.payos.vn/seed-${pad(index)}`,
        providerPaymentLinkId: `seed-payment-link-${pad(index)}`,
        providerTransactionReference:
          paymentStatus === 'PAID' ? `seed-txn-${pad(index)}` : null,
        failureReason: null,
        paidAt: paymentStatus === 'PAID' ? order.paidAt : null,
        cancelledAt: paymentStatus === 'CANCELLED' ? order.cancelledAt : null,
      },
    });

    payments.push(payment);
  }

  for (let index = 1; index <= TOTAL; index += 1) {
    const order = orders[index - 1];
    const payment = payments[index - 1];
    const customer = users[(index - 1) % users.length];
    const reviewer = users[index % users.length];

    await prisma.returnRequest.upsert({
      where: { id: `00000000-0000-4006-8000-${index.toString().padStart(12, '0')}` },
      update: {
        orderId: order.id,
        customerId: customer.id,
        reason: ['WRONG_SIZE', 'DAMAGED', 'NOT_AS_EXPECTED'][index % 3],
        description: `Seed return request ${pad(index)}`,
        status: returnStatuses[(index - 1) % returnStatuses.length],
        reviewedAt: index % 3 === 1 ? null : dateDaysAgo(index - 1),
        reviewedBy: index % 3 === 1 ? null : reviewer.id,
      },
      create: {
        id: `00000000-0000-4006-8000-${index.toString().padStart(12, '0')}`,
        orderId: order.id,
        customerId: customer.id,
        reason: ['WRONG_SIZE', 'DAMAGED', 'NOT_AS_EXPECTED'][index % 3],
        description: `Seed return request ${pad(index)}`,
        status: returnStatuses[(index - 1) % returnStatuses.length],
        reviewedAt: index % 3 === 1 ? null : dateDaysAgo(index - 1),
        reviewedBy: index % 3 === 1 ? null : reviewer.id,
      },
    });

    await prisma.paymentReconciliationIssue.upsert({
      where: {
        paymentId_type: {
          paymentId: payment.id,
          type: issueTypes[(index - 1) % issueTypes.length],
        },
      },
      update: {
        orderId: order.id,
        status: issueStatuses[(index - 1) % issueStatuses.length],
        provider: 'PAYOS',
        providerOrderCode: payment.providerOrderCode,
        providerPaymentLinkId: payment.providerPaymentLinkId,
        providerTransactionReference: payment.providerTransactionReference,
        amount: payment.amount,
        currency: payment.currency,
        safeReason: `Seed reconciliation issue ${pad(index)}`,
        resolvedAt: index % 3 === 0 ? dateDaysAgo(index - 1) : null,
        resolvedBy: index % 3 === 0 ? reviewer.id : null,
        adminNote: `Seed note ${pad(index)}`,
      },
      create: {
        orderId: order.id,
        paymentId: payment.id,
        type: issueTypes[(index - 1) % issueTypes.length],
        status: issueStatuses[(index - 1) % issueStatuses.length],
        provider: 'PAYOS',
        providerOrderCode: payment.providerOrderCode,
        providerPaymentLinkId: payment.providerPaymentLinkId,
        providerTransactionReference: payment.providerTransactionReference,
        amount: payment.amount,
        currency: payment.currency,
        safeReason: `Seed reconciliation issue ${pad(index)}`,
        resolvedAt: index % 3 === 0 ? dateDaysAgo(index - 1) : null,
        resolvedBy: index % 3 === 0 ? reviewer.id : null,
        adminNote: `Seed note ${pad(index)}`,
      },
    });

    await prisma.paymentWebhookEvent.upsert({
      where: {
        provider_eventKey: {
          provider: 'PAYOS',
          eventKey: `seed-webhook-${pad(index)}`,
        },
      },
      update: {
        signatureHash: `signature${index.toString().padStart(55, '0')}`.slice(0, 64),
        paymentId: payment.id,
        orderId: order.id,
        processedAt: dateDaysAgo(index - 1),
        processingStatus: index % 5 === 0 ? 'FAILED' : 'PROCESSED',
        metadata: { seed: true, index },
      },
      create: {
        provider: 'PAYOS',
        eventKey: `seed-webhook-${pad(index)}`,
        signatureHash: `signature${index.toString().padStart(55, '0')}`.slice(0, 64),
        paymentId: payment.id,
        orderId: order.id,
        processedAt: dateDaysAgo(index - 1),
        processingStatus: index % 5 === 0 ? 'FAILED' : 'PROCESSED',
        metadata: { seed: true, index },
      },
    });

    await prisma.landingGalleryImage.upsert({
      where: { id: `00000000-0000-4007-8000-${index.toString().padStart(12, '0')}` },
      update: {
        imageUrl: demoImage(`Gallery ${pad(index)}`, 'f4f4f5'),
        title: `Gallery ${pad(index)}`,
        caption: `Seed landing gallery image ${pad(index)}`,
        altText: `Seed gallery image ${pad(index)}`,
        sortOrder: index,
        isActive: true,
      },
      create: {
        id: `00000000-0000-4007-8000-${index.toString().padStart(12, '0')}`,
        imageUrl: demoImage(`Gallery ${pad(index)}`, 'f4f4f5'),
        title: `Gallery ${pad(index)}`,
        caption: `Seed landing gallery image ${pad(index)}`,
        altText: `Seed gallery image ${pad(index)}`,
        sortOrder: index,
        isActive: true,
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
