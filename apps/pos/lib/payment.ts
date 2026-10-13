// Shared by the DB schema, the sale API and the POS dropdown.
export const PAYMENT_METHODS = [
  'efectivo',
  'tarjeta',
  'transferencia',
  'pago_movil',
  'cashea',
  'otro',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Display names — `pago_movil` can't be derived from the key.
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  pago_movil: 'Pago Móvil',
  cashea: 'Cashea',
  otro: 'Otro',
};

/** Methods whose payment carries a bank reference number. */
export const REFERENCE_METHODS: PaymentMethod[] = ['transferencia', 'pago_movil'];

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}
