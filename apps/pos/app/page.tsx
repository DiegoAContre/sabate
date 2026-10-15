import { asc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, productSizes, products } from '@/db/client';
import { getSession } from '@/lib/auth';
import { getCurrentRate } from '@/lib/rate';
import { listTags } from '@/lib/tags';
import { PosScreen } from './pos-screen';

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [catalog, allSizes, rate] = await Promise.all([
    db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.name)),
    db.select().from(productSizes).orderBy(productSizes.size),
    getCurrentRate(),
  ]);
  const categoryNames = new Map(listTags('category').map((c) => [c.id, c.name]));
  const brandNames = new Map(listTags('brand').map((b) => [b.id, b.name]));
  const sizesByProduct = new Map<string, { size: string; quantity: number }[]>();
  for (const s of allSizes) {
    const list = sizesByProduct.get(s.productId) ?? [];
    list.push({ size: s.size, quantity: s.quantity });
    sizesByProduct.set(s.productId, list);
  }

  return (
    <PosScreen
      products={catalog.map((p) => ({
        ...p,
        category: p.categoryId ? (categoryNames.get(p.categoryId) ?? '') : '',
        brand: p.brandId ? (brandNames.get(p.brandId) ?? '') : '',
        sizes: sizesByProduct.get(p.id) ?? [],
      }))}
      rate={rate}
      isOwner={session.role === 'owner'}
      sellerName={session.name}
    />
  );
}
