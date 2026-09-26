import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, saleItems, sales, users } from '@/db/client';
import { CARACAS_TZ } from '@/lib/day';
import { formatBs, formatRate, formatUsd } from '@/lib/format';
import { Receipt } from '@/app/receipt';
import { PrintButton } from './print-button';
import { VoidButton } from './void-button';

const fmt = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: CARACAS_TZ,
});

export default async function VentaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const row = db
    .select({ sale: sales, userName: users.name })
    .from(sales)
    .leftJoin(users, eq(sales.userId, users.id))
    .where(eq(sales.id, id))
    .get();
  if (!row) notFound();

  const items = db.select().from(saleItems).where(eq(saleItems.saleId, id)).all();
  const { sale } = row;

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Venta</h1>
        <Link
          href="/ventas"
          className="text-sm text-gray-600 underline hover:text-gray-900"
        >
          Volver a ventas
        </Link>
      </div>

      <div className="no-print mb-6 grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-sm text-gray-600">Fecha</p>
          <p>{fmt.format(sale.createdAt)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Vendedor</p>
          <p>{row.userName ?? '—'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Método</p>
          <p>{sale.paymentMethod[0]!.toUpperCase() + sale.paymentMethod.slice(1)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Tasa usada</p>
          <p>{formatRate(sale.exchangeRate)} Bs/$</p>
        </div>
      </div>

      <div className="no-print mb-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2">Producto</th>
                <th className="py-2">Cantidad</th>
                <th className="py-2">Precio unitario</th>
                <th className="py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2">{formatUsd(item.unitPrice)}</td>
                  <td className="py-2">
                    {formatUsd(item.unitPrice * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-right font-semibold">
          {formatUsd(sale.total)} · {formatBs(sale.total, sale.exchangeRate)}
        </p>
      </div>

      {sale.voidedAt ? (
        <div className="no-print mb-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Anulada el {fmt.format(sale.voidedAt)}. El stock ya fue repuesto.
        </div>
      ) : (
        <div className="no-print mb-6">
          <VoidButton saleId={sale.id} total={formatUsd(sale.total)} />
        </div>
      )}

      <div className="rounded border border-gray-200 bg-white p-6">
        <Receipt
          sale={sale}
          items={items}
          sellerName={row.userName ?? '—'}
        />
      </div>

      <div className="no-print mt-4">
        <PrintButton />
      </div>
    </div>
  );
}
