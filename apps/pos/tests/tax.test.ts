import { describe, expect, it } from 'vitest';
import { formatBs } from '@/lib/format';
import { taxBreakdown } from '@/lib/tax';

const RATE = 910050; // 9100.50 Bs per USD

describe('taxBreakdown', () => {
  it('splits a known total into base + 16% IVA', () => {
    const { baseBsCents, ivaBsCents, totalBsCents } = taxBreakdown(600, RATE);

    expect(totalBsCents).toBe(5460300); // 54.603,00 Bs
    expect(baseBsCents).toBe(4707155);
    expect(ivaBsCents).toBe(753145);
  });

  it('base + iva always equals the total (both ways of computing it)', () => {
    for (const usd of [1, 99, 100, 250, 600, 9999, 123456]) {
      const { baseBsCents, ivaBsCents, totalBsCents } = taxBreakdown(
        usd,
        RATE,
      );
      expect(baseBsCents + ivaBsCents).toBe(totalBsCents);
      // The total matches precio × tasa (the other formula).
      expect(totalBsCents).toBe(
        Math.round((usd * RATE) / 100),
      );
    }
  });

  it('total matches the receipt Bs line', () => {
    expect(taxBreakdown(600, RATE).totalBsCents).toBe(
      Math.round((600 * RATE) / 100),
    );
    expect(formatBs(600, RATE)).toBe('Bs 54.603,00');
  });
});
