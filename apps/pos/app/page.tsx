import { asc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, products } from '@/db/client';
import { getSession } from '@/lib/auth';
import { getCurrentRate } from '@/lib/rate';
import { PosScreen } from './pos-screen';

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [catalog, rate] = await Promise.all([
    db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.name)),
    getCurrentRate(),
  ]);

  return (
    <PosScreen
      products={catalog}
      rate={rate}
      isOwner={session.role === 'owner'}
      sellerName={session.name}
    />
  );
}
