import { apiRequest } from '@/lib/api/client';
import { withQuery } from '@/lib/api/query';
import type {
  AdminReturnResponse,
  AdminReturnsResponse,
  CreateReturnRequest,
  CustomerReturnResponse,
  CustomerReturnsResponse,
  ReturnRequestStatus,
} from './types';

export function createReturnRequest(
  request: CreateReturnRequest,
): Promise<CustomerReturnResponse> {
  return apiRequest<CustomerReturnResponse>('/returns', {
    auth: true,
    body: request,
    credentials: 'include',
    method: 'POST',
  });
}

export function listMyReturnRequests(): Promise<CustomerReturnsResponse> {
  return apiRequest<CustomerReturnsResponse>('/returns/my', {
    auth: true,
    cache: 'no-store',
    credentials: 'include',
    method: 'GET',
  });
}

export function listAdminReturns(query: {
  page?: number;
  limit?: number;
  status?: ReturnRequestStatus;
} = {}): Promise<AdminReturnsResponse> {
  return apiRequest<AdminReturnsResponse>(withQuery('/admin/returns', query), {
    auth: true,
    cache: 'no-store',
    credentials: 'include',
    method: 'GET',
  });
}

export function getAdminReturn(id: string): Promise<AdminReturnResponse> {
  return apiRequest<AdminReturnResponse>(
    `/admin/returns/${encodeURIComponent(id)}`,
    {
      auth: true,
      cache: 'no-store',
      credentials: 'include',
      method: 'GET',
    },
  );
}

export function reviewAdminReturn(
  id: string,
  status: 'APPROVED' | 'REJECTED',
): Promise<AdminReturnResponse> {
  return apiRequest<AdminReturnResponse>(
    `/admin/returns/${encodeURIComponent(id)}/review`,
    {
      auth: true,
      body: { status },
      credentials: 'include',
      method: 'PATCH',
    },
  );
}
