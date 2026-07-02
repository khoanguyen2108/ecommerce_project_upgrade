import type { Metadata } from 'next';
import { AdminReturnDetailPage } from '@/components/admin-returns/AdminReturnDetailPage';

export const metadata: Metadata = { title: 'Return detail' };

export default async function AdminReturnDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminReturnDetailPage returnId={id} />;
}
