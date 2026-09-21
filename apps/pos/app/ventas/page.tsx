import Link from 'next/link';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db, sales, users } from '@/db/client';
import { CARACAS_TZ, caracasDayRange, caracasToday, isDay } from '@/lib/day';
import { formatBs, formatBsCents, formatUsd } from '@/lib/format';
import { summarize } from '@/lib/report';

const fmt = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: CARACAS_TZ,
});

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const today = caracasToday();
  const from = params.from && isDay(params.from) ? params.from : today;
  const to = params.to && isDay(params.to) ? params.to : from;

  const rows = await db
    .select({
      id: sales.id,
      total: sales.total,
      paymentMethod: sales.paymentMethod,
      exchangeRate: sales.exchangeRate,
      createdAt: sales.createdAt,
      voidedAt: sales.voidedAt,
      userName: users.name,
    })
    .from(sales)
    .leftJoin(users, eq(sales.userId, users.id))
    .where(
      and(
        gte(sales.createdAt, caracasDayRange(from).start),
        lt(sales.createdAt, caracasDayRange(to).end),
      ),
    )
    .orderBy(desc(sales.createdAt))
    .limit(500);

  const summary = summarize(rows);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Ventas</h1>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Desde</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Hasta</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700"
        >
          Filtrar
        </button>
        <Link
          href="/ventas"
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Hoy
        </Link>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total del período</p>
          <p className="text-xl font-bold">{formatUsd(summary.totalUsd)}</p>
          <p className="text-sm text-gray-600">
            {formatBsCents(summary.totalBs)}
          </p>
        </div>
        <div className="rounded border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Ventas</p>
          <p className="text-xl font-bold">{summary.count}</p>
        </div>
        <div className="rounded border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Anuladas</p>
          <p className="text-xl font-bold">{summary.voidedCount}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-6 sm:flex-row">
        <div className="flex-1">
          <h2 className="mb-2 text-lg font-semibold">Por día</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2">Día</th>
                <th className="py-2">Ventas</th>
                <th className="py-2">Total ($)</th>
                <th className="py-2">Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              {summary.byDay.map((d) => (
                <tr key={d.day} className="border-b border-gray-100">
                  <td className="py-2">{d.day}</td>
                  <td className="py-2">{d.count}</td>
                  <td className="py-2">{formatUsd(d.totalUsd)}</td>
                  <td className="py-2">{formatBsCents(d.totalBs)}</td>
                </tr>
              ))}
              {summary.byDay.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    Sin ventas en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex-1">
          <h2 className="mb-2 text-lg font-semibold">Por método de pago</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2">Método</th>
                <th className="py-2">Ventas</th>
                <th className="py-2">Total ($)</th>
                <th className="py-2">Total (Bs)</th>
              </tr>
            </thead>
            <tbody>
              {summary.byMethod.map((m) => (
                <tr key={m.method} className="border-b border-gray-100">
                  <td className="py-2">
                    {m.method[0]!.toUpperCase() + m.method.slice(1)}
                  </td>
                  <td className="py-2">{m.count}</td>
                  <td className="py-2">{formatUsd(m.totalUsd)}</td>
                  <td className="py-2">{formatBsCents(m.totalBs)}</td>
                </tr>
              ))}
              {summary.byMethod.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-500">
                    Sin ventas en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Detalle</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2">Fecha</th>
            <th className="py-2">Vendedor</th>
            <th className="py-2">Método</th>
            <th className="py-2">Total ($)</th>
            <th className="py-2">Total (Bs)</th>
            <th className="py-2">Estado</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-gray-100">
              <td className="py-2">{fmt.format(s.createdAt)}</td>
              <td className="py-2">{s.userName ?? '—'}</td>
              <td className="py-2">
                {s.paymentMethod[0]!.toUpperCase() + s.paymentMethod.slice(1)}
              </td>
              <td className="py-2">{formatUsd(s.total)}</td>
              <td className="py-2">{formatBs(s.total, s.exchangeRate)}</td>
              <td className="py-2">
                {s.voidedAt ? (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    anulada
                  </span>
                ) : (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    activa
                  </span>
                )}
              </td>
              <td className="py-2 text-right">
                <Link
                  href={`/ventas/${s.id}`}
                  className="text-gray-600 underline hover:text-gray-900"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-gray-500">
                Sin ventas en el período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
