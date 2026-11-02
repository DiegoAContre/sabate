import { desc, eq } from 'drizzle-orm';
import { db, exchangeRates, users } from '@/db/client';
import { getCurrentRate, RATE_VALIDITY_MS } from '@/lib/rate';
import { formatRate } from '@/lib/format';
import { RateForm } from './rate-form';

export default async function TasaPage() {
  const [rate, history] = await Promise.all([
    getCurrentRate(),
    db
      .select({
        bsPerUsd: exchangeRates.bsPerUsd,
        createdAt: exchangeRates.createdAt,
        userName: users.name,
      })
      .from(exchangeRates)
      .leftJoin(users, eq(exchangeRates.userId, users.id))
      .orderBy(desc(exchangeRates.createdAt))
      .limit(10),
  ]);

  const fmt = new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Tasa del día</h1>
      <p className="mb-6 text-sm text-slate-600">
        La tasa es válida durante {RATE_VALIDITY_MS / 3600000} horas — el punto de
        venta la necesita vigente para poder vender.
      </p>

      <div className="mb-8 max-w-sm card p-4">
        {rate ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatRate(rate.bsPerUsd)}</span>
              <span className="text-slate-500">Bs/$</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Establecida: {fmt.format(rate.createdAt)}
            </p>
            <p className="text-sm text-slate-600">
              Vence: {fmt.format(rate.expiresAt)}
            </p>
            <p
              className={
                rate.isValid
                  ? 'mt-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700'
                  : 'mt-2 inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700'
              }
            >
              {rate.isValid ? 'Válida' : 'Vencida'}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            No se ha establecido ninguna tasa todavía.
          </p>
        )}
      </div>

      <RateForm />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Historial</h2>
      <div className="card overflow-x-auto p-4">
        <table className="w-full min-w-[20rem] max-w-md text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Tasa (Bs/$)</th>
              <th className="py-2">Establecida por</th>
              <th className="py-2">Cuándo</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.createdAt.toISOString()} className="border-b border-slate-100">
                <td className="py-2 font-medium">{formatRate(r.bsPerUsd)}</td>
                <td className="py-2 text-slate-600">{r.userName ?? '—'}</td>
                <td className="py-2 text-slate-600">{fmt.format(r.createdAt)}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-500">
                  Sin historial.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
