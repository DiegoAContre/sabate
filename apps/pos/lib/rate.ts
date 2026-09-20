import { desc } from 'drizzle-orm';
import { db, exchangeRates } from '@/db/client';

// A rate lasts one working day — 12 hours from when it was set.
export const RATE_VALIDITY_MS = 12 * 60 * 60 * 1000;

export interface CurrentRate {
  /** Integer céntimos de Bs per 1 USD (9100.50 Bs → 910050). */
  bsPerUsd: number;
  createdAt: Date;
  expiresAt: Date;
  isValid: boolean;
}

/** Latest set rate + its 12h validity. Null when no rate was ever set. */
export async function getCurrentRate(): Promise<CurrentRate | null> {
  const [latest] = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.createdAt))
    .limit(1);
  if (!latest) return null;

  const expiresAt = new Date(latest.createdAt.getTime() + RATE_VALIDITY_MS);
  return {
    bsPerUsd: latest.bsPerUsd,
    createdAt: latest.createdAt,
    expiresAt,
    isValid: Date.now() < expiresAt.getTime(),
  };
}
