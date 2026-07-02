import type { Pagination } from '@/lib/api/types';

export type ReturnRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ReturnReason =
  | 'WRONG_SIZE'
  | 'WRONG_ITEM'
  | 'DAMAGED'
  | 'CHANGED_MIND'
  | 'OTHER';

export interface CreateReturnRequest {
  orderCode: string;
  reason: ReturnReason;
  description?: string;
}

export interface CustomerReturnRequest {
  orderCode: string;
  deliveredAt: string | null;
  reason: ReturnReason;
  description: string | null;
  status: ReturnRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface CustomerReturnResponse {
  returnRequest: CustomerReturnRequest;
}

export interface CustomerReturnsResponse {
  returnRequests: CustomerReturnRequest[];
}

export interface AdminReturnCustomer {
  email: string;
  name: string | null;
}

export interface AdminReturnSummary {
  id: string;
  orderCode: string;
  customer: AdminReturnCustomer;
  reason: ReturnReason;
  status: ReturnRequestStatus;
  createdAt: string;
}

export interface AdminReturnOrder {
  orderCode: string;
  status: string;
  fulfillmentStatus: string;
  fulfilledAt: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface AdminReturnRequest {
  id: string;
  order: AdminReturnOrder;
  customer: AdminReturnCustomer;
  reason: ReturnReason;
  description: string | null;
  status: ReturnRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewer: AdminReturnCustomer | null;
}

export interface AdminReturnsResponse {
  returnRequests: AdminReturnSummary[];
  pagination: Pagination;
}

export interface AdminReturnResponse {
  returnRequest: AdminReturnRequest;
}
