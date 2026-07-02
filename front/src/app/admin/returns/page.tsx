import type { Metadata } from 'next';
import { AdminReturnsPage } from '@/components/admin-returns/AdminReturnsPage';

export const metadata: Metadata = { title: 'Returns' };

export default function AdminReturnsRoute() {
  return <AdminReturnsPage />;
}
