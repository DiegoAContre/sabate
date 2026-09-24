import { asc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, products } from '@/db/client';
import { getSession } from '@/lib/auth';
import { getCurrentRate } from '@/lib/rate';
import { listTags } from '@/lib/tags';
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
  const categoryNames = new Map(listTags('category').map((c) => [c.id, c.name]));
  const brandNames = new Map(listTags('brand').map((b) => [b.id, b.name]));

  return (
    <PosScreen
      products={catalog.map((p) => ({
        ...p,
        category: p.categoryId ? (categoryNames.get(p.categoryId) ?? '') : '',
        brand: p.brandId ? (brandNames.get(p.brandId) ?? '') : '',
      }))}
      rate={rate}
      isOwner={session.role === 'owner'}
      sellerName={session.name}
    />
  );
}
