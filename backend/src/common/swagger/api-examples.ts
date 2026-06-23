import type { ApiResponseOptions } from '@nestjs/swagger';

const requestIdExample = '9d6f1c8a-43a7-4f3b-b11c-9a88ad85f7f1';

export const envelopeExample = (data: unknown) => ({
  data,
  meta: {
    requestId: requestIdExample,
  },
  error: null,
});

export const errorEnvelopeExample = (code: string, message: string) => ({
  data: null,
  meta: {
    requestId: requestIdExample,
  },
  error: {
    code,
    message,
  },
});

export const envelopeResponse = (
  description: string,
  data: unknown,
): ApiResponseOptions => ({
  description,
  schema: {
    example: envelopeExample(data),
  },
});

export const errorEnvelopeResponse = (
  description: string,
  code: string,
  message: string,
): ApiResponseOptions => ({
  description,
  schema: {
    example: errorEnvelopeExample(code, message),
  },
});

export const publicUserExample = {
  id: 'a6f26aef-d26e-40f2-8a58-1e36ff7f6f65',
  email: 'customer@example.com',
  name: 'Belikeme Customer',
  phone: '+84901234567',
  role: 'CUSTOMER',
  authProvider: 'EMAIL',
  createdAt: '2026-06-10T10:30:00.000Z',
  updatedAt: '2026-06-10T10:30:00.000Z',
};

export const addressExample = {
  id: 'd98ffbf3-42d8-4c50-93e4-77f2903a50b3',
  recipientName: 'Nguyen Van An',
  phone: '0901234567',
  province: 'Ho Chi Minh City',
  district: 'District 1',
  ward: 'Ben Nghe Ward',
  addressLine: '12 Nguyen Hue Street',
  note: 'Call before delivery',
  isDefault: true,
  createdAt: '2026-06-20T10:30:00.000Z',
  updatedAt: '2026-06-20T10:30:00.000Z',
};

export const addressDataExample = { address: addressExample };
export const addressListDataExample = { addresses: [addressExample] };

export const adminUserExample = {
  ...publicUserExample,
  isActive: true,
};

export const adminUserDataExample = {
  user: adminUserExample,
};

export const adminUserListDataExample = {
  users: [adminUserExample],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

export const adminVoucherExample = {
  id: '5a7fb7f4-acde-46a5-90b8-f1f950f7aa08',
  code: 'SAVE10',
  name: 'Save ten percent',
  description: 'Ten percent off qualifying orders.',
  discountType: 'PERCENT',
  discountValue: 10,
  minSubtotal: 300000,
  maxDiscount: 50000,
  usageLimit: 100,
  perUserLimit: 1,
  startsAt: '2026-06-20T00:00:00.000Z',
  endsAt: '2026-07-20T00:00:00.000Z',
  isActive: true,
  createdAt: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
};

export const adminVoucherDataExample = {
  voucher: adminVoucherExample,
};

export const adminVoucherListDataExample = {
  vouchers: [adminVoucherExample],
  pagination: {
    page: 1,
    limit: 8,
    total: 1,
    totalPages: 1,
  },
};

export const authTokenDataExample = {
  user: publicUserExample,
  accessToken: 'access_token_placeholder',
  refreshToken: 'refresh_token_placeholder_value',
  tokenType: 'Bearer',
  expiresIn: '15m',
};

export const logoutDataExample = {
  success: true,
};

export const currentUserDataExample = {
  user: {
    id: publicUserExample.id,
    email: publicUserExample.email,
    name: publicUserExample.name,
    phone: publicUserExample.phone,
    role: publicUserExample.role,
    authProvider: publicUserExample.authProvider,
  },
};

export const updatedUserDataExample = {
  user: publicUserExample,
};

export const passwordResetRequestDataExample = {
  success: true,
  message:
    'If an account exists for that email, a password reset code has been sent.',
};

export const passwordResetVerifiedDataExample = {
  success: true,
  message: 'Password reset code verified.',
};

export const passwordResetCompleteDataExample = {
  success: true,
  message: 'Password has been reset.',
};

export const healthDataExample = {
  status: 'ok',
  service: 'belikeme-backend',
  timestamp: '2026-06-10T10:30:00.000Z',
};

export const dependencyHealthDataExample = {
  status: 'ok',
};

export const categoryExample = {
  id: '64c4bb83-3df2-45d8-85a0-1c18c3a1d675',
  name: 'T-Shirts',
  slug: 't-shirts',
  description: 'Everyday cotton tees.',
  isActive: true,
  createdAt: '2026-06-10T10:30:00.000Z',
  updatedAt: '2026-06-10T10:30:00.000Z',
};

export const categoryListDataExample = {
  categories: [categoryExample],
};

export const adminCategoryListDataExample = {
  categories: [categoryExample],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

const productCategoryExample = {
  id: categoryExample.id,
  name: categoryExample.name,
  slug: categoryExample.slug,
};

export const productVariantExample = {
  id: 'b7e6d845-fb16-42f9-9402-c3c2d363c4a1',
  productId: '5598228d-8f08-4ddd-8869-9f0d5fb1ad77',
  sku: 'TEE-BASIC-BLK-M',
  size: 'M',
  color: 'Black',
  stock: 24,
  priceOverride: null,
  isActive: true,
  createdAt: '2026-06-10T10:30:00.000Z',
  updatedAt: '2026-06-10T10:30:00.000Z',
};

export const productExample = {
  id: productVariantExample.productId,
  categoryId: categoryExample.id,
  name: 'Classic Cotton T-Shirt',
  slug: 'classic-cotton-t-shirt',
  description: 'Soft crew neck t-shirt for daily wear.',
  basePrice: 249000,
  imageUrls: ['https://example.com/images/classic-cotton-t-shirt.jpg'],
  isActive: true,
  createdAt: '2026-06-10T10:30:00.000Z',
  updatedAt: '2026-06-10T10:30:00.000Z',
  category: productCategoryExample,
  categories: [productCategoryExample],
  variants: [productVariantExample],
};

export const productListDataExample = {
  products: [productExample],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

export const productVariantsDataExample = {
  variants: [productVariantExample],
};

export const productVariantListDataExample = {
  variants: [productVariantExample],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

export const categoryDataExample = {
  category: categoryExample,
};

export const productDataExample = {
  product: productExample,
};

export const productVariantDataExample = {
  variant: productVariantExample,
};

export const cartItemExample = {
  id: '54da8e6c-eed6-4732-bd95-761e60ed9b39',
  variantId: productVariantExample.id,
  quantity: 2,
  currentUnitPrice: 249000,
  currentLineTotal: 498000,
  availableStock: productVariantExample.stock,
  product: {
    id: productExample.id,
    name: productExample.name,
    slug: productExample.slug,
    imageUrls: productExample.imageUrls,
    firstImageUrl: productExample.imageUrls[0],
    category: productCategoryExample,
  },
  variant: {
    sku: productVariantExample.sku,
    size: productVariantExample.size,
    color: productVariantExample.color,
    priceOverride: productVariantExample.priceOverride,
    stock: productVariantExample.stock,
  },
  createdAt: '2026-06-17T10:30:00.000Z',
  updatedAt: '2026-06-17T10:30:00.000Z',
};

export const cartExample = {
  id: '1e0a13f7-beca-493d-8f1e-a03b1b911a34',
  userId: publicUserExample.id,
  items: [cartItemExample],
  totalQuantity: 2,
  estimatedSubtotal: 498000,
  createdAt: '2026-06-17T10:30:00.000Z',
  updatedAt: '2026-06-17T10:30:00.000Z',
};

export const cartDataExample = {
  cart: cartExample,
};

export const checkoutSummaryDataExample = {
  summary: {
    items: [
      {
        cartItemId: cartItemExample.id,
        variantId: productVariantExample.id,
        productId: productExample.id,
        productName: productExample.name,
        productSlug: productExample.slug,
        imageUrl: productExample.imageUrls[0],
        imageUrls: productExample.imageUrls,
        categoryName: categoryExample.name,
        categorySlug: categoryExample.slug,
        sku: productVariantExample.sku,
        size: productVariantExample.size,
        color: productVariantExample.color,
        quantity: 2,
        availableStock: productVariantExample.stock,
        currentUnitPrice: 249000,
        currentLineTotal: 498000,
      },
    ],
    totalQuantity: 2,
    subtotalAmount: 498000,
    discountAmount: 49800,
    totalAmount: 448200,
    currency: 'VND',
    appliedVoucher: {
      code: 'SAVE10',
      name: 'Save ten percent',
      discountType: 'PERCENT',
      discountValue: 10,
      maxDiscount: 50000,
      minSubtotal: 300000,
    },
    voucherError: null,
    eligibleVouchers: [
      {
        code: 'SAVE10',
        name: 'Save ten percent',
        discountType: 'PERCENT',
        discountValue: 10,
        maxDiscount: 50000,
        minSubtotal: 300000,
      },
    ],
    warnings: [],
  },
};

export const orderItemExample = {
  id: '4eb1a5f0-21dd-4553-9f55-7f9d5afcaa74',
  orderId: '7b2cb6b6-0501-4d7b-8e30-98db06a7f605',
  productId: productExample.id,
  variantId: productVariantExample.id,
  productName: productExample.name,
  imageUrl: productExample.imageUrls[0],
  sku: productVariantExample.sku,
  size: productVariantExample.size,
  color: productVariantExample.color,
  unitPrice: 249000,
  quantity: 1,
  lineTotal: 249000,
  createdAt: '2026-06-14T10:30:00.000Z',
};

export const paymentExample = {
  id: '1b3d98f7-e285-4d30-8298-668a6b0cd5b8',
  orderId: orderItemExample.orderId,
  provider: 'PAYOS',
  status: 'PENDING',
  amount: 249000,
  currency: 'VND',
  providerOrderCode: 100001,
  checkoutUrl: 'https://pay.payos.vn/web/124c33293c43417ab7879e14c8d9eb18',
  providerPaymentLinkId: '124c33293c43417ab7879e14c8d9eb18',
  providerTransactionReference: null,
  failureReason: null,
  createdAt: '2026-06-14T10:30:00.000Z',
  updatedAt: '2026-06-14T10:30:00.000Z',
  paidAt: null,
  cancelledAt: null,
};

export const orderExample = {
  id: orderItemExample.orderId,
  userId: publicUserExample.id,
  status: 'PENDING_PAYMENT',
  fulfillmentStatus: 'PENDING',
  subtotalAmount: 249000,
  discountAmount: 0,
  totalAmount: 249000,
  voucherId: null,
  voucherCodeSnapshot: null,
  voucherNameSnapshot: null,
  currency: 'VND',
  shippingRecipientName: addressExample.recipientName,
  shippingPhone: addressExample.phone,
  shippingProvince: addressExample.province,
  shippingDistrict: addressExample.district,
  shippingWard: addressExample.ward,
  shippingAddressLine: addressExample.addressLine,
  shippingNote: addressExample.note,
  createdAt: '2026-06-14T10:30:00.000Z',
  updatedAt: '2026-06-14T10:30:00.000Z',
  paidAt: null,
  fulfilledAt: null,
  cancelledAt: null,
  expiresAt: '2026-06-14T11:00:00.000Z',
  items: [orderItemExample],
  payments: [paymentExample],
};

export const orderDataExample = {
  order: orderExample,
};

export const orderListDataExample = {
  orders: [orderExample],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

const adminOrderUserSummaryExample = {
  id: publicUserExample.id,
  email: publicUserExample.email,
  name: publicUserExample.name,
  phone: publicUserExample.phone,
};

const adminWebhookEventSummaryExample = {
  id: 'a8ff4d13-3828-43af-b410-c1fbf469fa8e',
  provider: 'PAYOS',
  paymentId: paymentExample.id,
  orderId: orderExample.id,
  receivedAt: '2026-06-14T10:36:00.000Z',
  processedAt: '2026-06-14T10:36:01.000Z',
  processingStatus: 'PROCESSED',
};

const paymentReconciliationIssueExample = {
  id: '6e2f09c7-c633-4592-9d4c-91b0fe25dd76',
  orderId: orderExample.id,
  paymentId: paymentExample.id,
  type: 'PAID_STOCK_SHORTAGE',
  status: 'OPEN',
  provider: 'PAYOS',
  providerOrderCode: paymentExample.providerOrderCode,
  providerPaymentLinkId: paymentExample.providerPaymentLinkId,
  providerTransactionReference: 'TF230204212323',
  amount: paymentExample.amount,
  currency: paymentExample.currency,
  safeReason: 'Provider confirmed payment, but local stock is insufficient.',
  createdAt: '2026-06-14T10:36:01.000Z',
  updatedAt: '2026-06-14T10:36:01.000Z',
  resolvedAt: null,
  resolvedBy: null,
  adminNote: null,
};

export const adminOrderSummaryExample = {
  id: orderExample.id,
  user: adminOrderUserSummaryExample,
  status: orderExample.status,
  fulfillmentStatus: orderExample.fulfillmentStatus,
  subtotalAmount: orderExample.subtotalAmount,
  totalAmount: orderExample.totalAmount,
  currency: orderExample.currency,
  itemCount: 1,
  latestPayment: paymentExample,
  createdAt: orderExample.createdAt,
  updatedAt: orderExample.updatedAt,
  paidAt: orderExample.paidAt,
  fulfilledAt: orderExample.fulfilledAt,
  cancelledAt: orderExample.cancelledAt,
  expiresAt: orderExample.expiresAt,
};

export const adminOrderDetailExample = {
  ...adminOrderSummaryExample,
  items: [orderItemExample],
  payments: [paymentExample],
  webhookEvents: [adminWebhookEventSummaryExample],
  paymentReconciliationIssues: [paymentReconciliationIssueExample],
};

export const adminOrderDataExample = {
  order: adminOrderDetailExample,
};

export const adminOrderListDataExample = {
  orders: [adminOrderSummaryExample],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

export const adminPaymentSummaryExample = {
  id: paymentExample.id,
  provider: paymentExample.provider,
  status: paymentExample.status,
  amount: paymentExample.amount,
  currency: paymentExample.currency,
  providerOrderCode: paymentExample.providerOrderCode,
  providerPaymentLinkId: paymentExample.providerPaymentLinkId,
  providerTransactionReference: paymentExample.providerTransactionReference,
  failureReason: paymentExample.failureReason,
  reconciliationIssues: [paymentReconciliationIssueExample],
  order: {
    id: orderExample.id,
    userId: orderExample.userId,
    status: orderExample.status,
    subtotalAmount: orderExample.subtotalAmount,
    totalAmount: orderExample.totalAmount,
    currency: orderExample.currency,
    itemCount: 1,
    createdAt: orderExample.createdAt,
    updatedAt: orderExample.updatedAt,
    paidAt: orderExample.paidAt,
    cancelledAt: orderExample.cancelledAt,
    expiresAt: orderExample.expiresAt,
  },
  user: adminOrderUserSummaryExample,
  createdAt: paymentExample.createdAt,
  updatedAt: paymentExample.updatedAt,
  paidAt: paymentExample.paidAt,
  cancelledAt: paymentExample.cancelledAt,
};

export const adminPaymentDetailExample = {
  ...adminPaymentSummaryExample,
  orderId: paymentExample.orderId,
  checkoutUrl: paymentExample.checkoutUrl,
  webhookEvents: [adminWebhookEventSummaryExample],
};

export const adminPaymentDataExample = {
  payment: adminPaymentDetailExample,
};

export const adminPaymentListDataExample = {
  payments: [adminPaymentSummaryExample],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

export const adminPayosReadinessDataExample = {
  readiness: {
    payosClientIdConfigured: true,
    payosApiKeyConfigured: true,
    payosChecksumKeyConfigured: true,
    returnUrlConfigured: true,
    cancelUrlConfigured: true,
    webhookUrlConfigured: true,
    webhookPathMatches: true,
    backendUrlConfigured: true,
    environmentReady: true,
    credentials: {
      clientId: { present: true, length: 36 },
      apiKey: { present: true, length: 64 },
      checksumKey: { present: true, length: 64 },
    },
    urls: {
      return: {
        configured: true,
        valid: true,
        host: 'ecommerce-project-upgrade.vercel.app',
        url: 'https://ecommerce-project-upgrade.vercel.app/payment/return',
      },
      cancel: {
        configured: true,
        valid: true,
        host: 'ecommerce-project-upgrade.vercel.app',
        url: 'https://ecommerce-project-upgrade.vercel.app/payment/cancel',
      },
      webhook: {
        configured: true,
        valid: true,
        host: 'ecommerce-project-upgrade-1.onrender.com',
        url: 'https://ecommerce-project-upgrade-1.onrender.com/payments/payos/webhook',
      },
      backend: {
        configured: true,
        valid: true,
        host: 'ecommerce-project-upgrade-1.onrender.com',
        url: 'https://ecommerce-project-upgrade-1.onrender.com/',
      },
    },
    webhookEndpointPath: '/payments/payos/webhook',
    warnings: [],
  },
};

export const payosPaymentDataExample = {
  paymentId: paymentExample.id,
  orderId: paymentExample.orderId,
  status: paymentExample.status,
  checkoutUrl: paymentExample.checkoutUrl,
  paymentUrl: paymentExample.checkoutUrl,
  qrCode: '00020101021238570010A000000727012700069704220113VQRQ0000000000208QRIBFTTA530370454062490005802VN',
  amount: paymentExample.amount,
  expiredAt: orderExample.expiresAt,
  payment: paymentExample,
};

export const payosWebhookDataExample = {
  received: true,
  duplicate: false,
  processed: true,
  payment: {
    ...paymentExample,
    status: 'PAID',
    paidAt: '2026-06-14T10:35:00.000Z',
  },
};

export const payosStatusDataExample = {
  source: 'return',
  displayOnly: true,
  message:
    'Payment return and cancel pages are display-only. Final status is set only by verified payOS webhook.',
  statusMessage: 'Payment is pending until a verified payOS webhook updates it.',
  orderStatus: orderExample.status,
  paymentStatus: paymentExample.status,
  paidAt: null,
  providerOrderCode: paymentExample.providerOrderCode,
  orderId: orderExample.id,
  amount: paymentExample.amount,
  currency: paymentExample.currency,
  reconciliationRequired: false,
  retryEligible: true,
  order: {
    id: orderExample.id,
    userId: orderExample.userId,
    status: orderExample.status,
    fulfillmentStatus: orderExample.fulfillmentStatus,
    totalAmount: orderExample.totalAmount,
    currency: orderExample.currency,
    createdAt: orderExample.createdAt,
    updatedAt: orderExample.updatedAt,
    paidAt: null,
    cancelledAt: null,
    expiresAt: orderExample.expiresAt,
  },
  payment: paymentExample,
};

export const adminStatsOverviewDataExample = {
  overview: {
    totalRevenue: 249000,
    paidOrdersCount: 1,
    pendingOrdersCount: 2,
    cancelledOrdersCount: 0,
    expiredOrdersCount: 0,
    averagePaidOrderValue: 249000,
    totalCustomers: 24,
    totalProducts: 12,
    lowStockVariantsCount: 3,
    filters: {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
    },
  },
};

export const adminStatsRevenueDataExample = {
  revenue: {
    groupBy: 'day',
    totalRevenue: 249000,
    paidOrdersCount: 1,
    buckets: [
      {
        periodStart: '2026-06-14T00:00:00.000Z',
        periodEnd: '2026-06-14T23:59:59.999Z',
        revenue: 249000,
        paidOrdersCount: 1,
      },
    ],
    filters: {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
    },
  },
};

export const adminTopProductsDataExample = {
  topProducts: [
    {
      productId: productExample.id,
      name: productExample.name,
      slug: productExample.slug,
      imageUrl: productExample.imageUrls[0],
      categoryName: categoryExample.name,
      soldQuantity: 4,
    },
  ],
  limit: 10,
  filters: {
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-06-30T23:59:59.999Z',
  },
};

export const adminOrderStatsDataExample = {
  orders: {
    total: 3,
    byStatus: {
      PENDING_PAYMENT: 2,
      PAID: 1,
      CANCELLED: 0,
      EXPIRED: 0,
    },
    counts: [
      {
        status: 'PENDING_PAYMENT',
        count: 2,
      },
      {
        status: 'PAID',
        count: 1,
      },
      {
        status: 'CANCELLED',
        count: 0,
      },
      {
        status: 'EXPIRED',
        count: 0,
      },
    ],
    filters: {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
      status: null,
    },
  },
};
