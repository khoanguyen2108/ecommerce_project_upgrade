import type { Pagination } from "@/lib/api/types";

export type VoucherDiscountType = "PERCENT" | "FIXED";

export interface AdminVoucher {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: VoucherDiscountType;
  discountValue: number;
  minSubtotal: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVoucherQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface AdminVoucherWriteRequest {
  code: string;
  name: string;
  description?: string | null;
  discountType: VoucherDiscountType;
  discountValue: number;
  minSubtotal: number;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export type UpdateAdminVoucherRequest = Partial<AdminVoucherWriteRequest>;

export interface AdminVouchersListResponse {
  vouchers: AdminVoucher[];
  pagination: Pagination;
}

export interface AdminVoucherResponse {
  voucher: AdminVoucher;
}

export interface AdminVoucherDeleteResponse {
  deletedId: string;
}
