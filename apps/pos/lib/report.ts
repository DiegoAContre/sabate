import { caracasDayOf } from './day';

export interface ReportSale {
  /** USD cents. */
  total: number;
  /** Snapshot of bs_per_usd (céntimos de Bs per USD) at sale time. */
  exchangeRate: number;
  paymentMethod: string;
  createdAt: Date;
  voidedAt: Date | null;
}

export interface Totals {
  count: number;
  /** USD cents. */
  totalUsd: number;
  /** Céntimos de Bs. */
  totalBs: number;
}

export interface Summary extends Totals {
  voidedCount: number;
  byDay: (Totals & { day: string })[];
  byMethod: (Totals & { method: string })[];
}

/** USD cents → céntimos de Bs at that sale's own rate (matches its receipt). */
export function bsCents(usdCents: number, bsPerUsd: number): number {
  return Math.round((usdCents * bsPerUsd) / 100);
}

const empty = (): Totals => ({ count: 0, totalUsd: 0, totalBs: 0 });

function add(totals: Totals, sale: ReportSale) {
  totals.count += 1;
  totals.totalUsd += sale.total;
  totals.totalBs += bsCents(sale.total, sale.exchangeRate);
}

/** Totals for a period. Voided sales are listed but never counted. */
export function summarize(sales: ReportSale[]): Summary {
  const total = empty();
  const byDay = new Map<string, Totals>();
  const byMethod = new Map<string, Totals>();
  let voidedCount = 0;

  for (const sale of sales) {
    if (sale.voidedAt) {
      voidedCount += 1;
      continue;
    }
    add(total, sale);

    const day = caracasDayOf(sale.createdAt);
    const dayTotals = byDay.get(day) ?? empty();
    add(dayTotals, sale);
    byDay.set(day, dayTotals);

    const methodTotals = byMethod.get(sale.paymentMethod) ?? empty();
    add(methodTotals, sale);
    byMethod.set(sale.paymentMethod, methodTotals);
  }

  return {
    ...total,
    voidedCount,
    byDay: [...byDay]
      .map(([day, t]) => ({ day, ...t }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byMethod: [...byMethod]
      .map(([method, t]) => ({ method, ...t }))
      .sort((a, b) => b.totalUsd - a.totalUsd),
  };
}
