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

export const orderItemExample = {
  id: '4eb1a5f0-21dd-4553-9f55-7f9d5afcaa74',
  orderId: '7b2cb6b6-0501-4d7b-8e30-98db06a7f605',
  productId: productExample.id,
  variantId: productVariantExample.id,
  productName: productExample.name,
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
  subtotalAmount: 249000,
  totalAmount: 249000,
  currency: 'VND',
  createdAt: '2026-06-14T10:30:00.000Z',
  updatedAt: '2026-06-14T10:30:00.000Z',
  paidAt: null,
  cancelledAt: null,
  expiresAt: null,
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

export const payosPaymentDataExample = {
  checkoutUrl: paymentExample.checkoutUrl,
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
  order: {
    id: orderExample.id,
    userId: orderExample.userId,
    status: orderExample.status,
    totalAmount: orderExample.totalAmount,
    currency: orderExample.currency,
    createdAt: orderExample.createdAt,
    updatedAt: orderExample.updatedAt,
    paidAt: null,
    cancelledAt: null,
    expiresAt: null,
  },
  payment: paymentExample,
};
