import { describe, expect, it } from 'vitest';
import { caracasDayOf, caracasDayRange, isDay } from '@/lib/day';
import { bsCents, summarize, type ReportSale } from '@/lib/report';

const RATE = 910050; // 9100.50 Bs per USD

function sale(over: Partial<ReportSale> = {}): ReportSale {
  return {
    total: 500,
    exchangeRate: RATE,
    paymentMethod: 'efectivo',
    createdAt: new Date('2026-09-21T18:00:00Z'),
    voidedAt: null,
    ...over,
  };
}

describe('Caracas day', () => {
  it('cuts the day at local midnight (UTC−4)', () => {
    expect(caracasDayOf(new Date('2026-09-21T04:00:00Z'))).toBe('2026-09-21');
    expect(caracasDayOf(new Date('2026-09-22T03:59:00Z'))).toBe('2026-09-21');
    expect(caracasDayOf(new Date('2026-09-22T04:00:00Z'))).toBe('2026-09-22');
  });

  it('range spans the whole local day', () => {
    const { start, end } = caracasDayRange('2026-09-21');
    expect(start.toISOString()).toBe('2026-09-21T04:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-22T04:00:00.000Z');
  });

  it('validates day strings', () => {
    expect(isDay('2026-09-21')).toBe(true);
    expect(isDay('21/09/2026')).toBe(false);
  });
});

describe('summarize', () => {
  it('totals each sale in Bs at its own rate and skips voided ones', () => {
    const summary = summarize([
      sale({ total: 500, exchangeRate: RATE }),
      sale({ total: 100, exchangeRate: 920000, paymentMethod: 'tarjeta' }),
      sale({ total: 999, voidedAt: new Date() }),
    ]);

    expect(summary.count).toBe(2);
    expect(summary.totalUsd).toBe(600);
    expect(summary.totalBs).toBe(4550250 + 920000);
    expect(summary.voidedCount).toBe(1);
    expect(summary.byMethod.map((m) => m.method)).toEqual([
      'efectivo',
      'tarjeta',
    ]);
  });

  it('groups by Caracas day', () => {
    const summary = summarize([
      sale({ createdAt: new Date('2026-09-21T20:00:00Z') }), // 16:00 local
      sale({ createdAt: new Date('2026-09-22T02:00:00Z') }), // 22:00 local, same day
      sale({ createdAt: new Date('2026-09-22T10:00:00Z') }), // 06:00 local, next day
    ]);

    expect(summary.byDay.map((d) => d.day)).toEqual([
      '2026-09-21',
      '2026-09-22',
    ]);
    expect(summary.byDay[0]).toMatchObject({ count: 2, totalUsd: 1000 });
    expect(summary.byDay[1]).toMatchObject({ count: 1 });
  });

  it('converts a total to Bs céntimos', () => {
    expect(bsCents(600, RATE)).toBe(5460300);
  });
});
