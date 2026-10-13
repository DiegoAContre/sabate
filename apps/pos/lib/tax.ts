import { bsCents } from './report';

// Venezuela IVA general rate: 16% → total = base × 1.16 = base × 116/100.
export interface TaxBreakdown {
  /** Base imponible, céntimos de Bs. */
  baseBsCents: number;
  /** IVA (16%), céntimos de Bs. */
  ivaBsCents: number;
  /** Total, céntimos de Bs (precio USD × tasa). */
  totalBsCents: number;
}

/**
 * Desglose IVA / base imponible. El total sale del precio en $ × la tasa del
 * día; la base es total / 1.16 y el IVA es `total − base`, así
 * `base + iva === total` exacto (las dos formas de calcular el total coinciden).
 */
export function taxBreakdown(usdCents: number, bsPerUsd: number): TaxBreakdown {
  const totalBsCents = bsCents(usdCents, bsPerUsd);
  const baseBsCents = Math.round((totalBsCents * 100) / 116);
  const ivaBsCents = totalBsCents - baseBsCents;
  return { baseBsCents, ivaBsCents, totalBsCents };
}
