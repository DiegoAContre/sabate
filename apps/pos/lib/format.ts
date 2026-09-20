const number = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** USD cents → "$ 1.234,56". */
export function formatUsd(usdCents: number): string {
  return `$ ${number.format(usdCents / 100)}`;
}

/**
 * USD cents + rate (céntimos de Bs per USD) → "Bs 91.005,00".
 * bs céntimos = usdCents × bsPerUsd / 100.
 */
export function formatBs(usdCents: number, bsPerUsd: number): string {
  const bsCentimos = Math.round((usdCents * bsPerUsd) / 100);
  return `Bs ${number.format(bsCentimos / 100)}`;
}

/** Decimal Bs per USD for display: 910050 → "9.100,50". */
export function formatRate(bsPerUsd: number): string {
  return number.format(bsPerUsd / 100);
}
