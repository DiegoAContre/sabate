// Shared by the DB schema, the sale API and the POS dropdown.
export const PAYMENT_METHODS = [
  'efectivo',
  'tarjeta',
  'transferencia',
  'cashea',
  'otro',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
