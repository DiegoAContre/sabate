import { formatBsCents, formatRate, formatUsd } from '@/lib/format';
import { paymentMethodLabel } from '@/lib/payment';
import { taxBreakdown } from '@/lib/tax';

export interface ReceiptSale {
  id: string;
  total: number;
  paymentMethod: string;
  exchangeRate: number;
  reference?: string | null;
  createdAt: string | Date;
}

export interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

const dateTime = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function Receipt({
  sale,
  items,
  sellerName,
}: {
  sale: ReceiptSale;
  items: ReceiptItem[];
  sellerName: string;
}) {
  const { baseBsCents, ivaBsCents, totalBsCents } = taxBreakdown(
    sale.total,
    sale.exchangeRate,
  );

  return (
    <div className="mx-auto w-72 text-sm text-black">
      <p className="text-center text-base font-bold">Sabate</p>
      <p className="text-center text-xs text-gray-600">
        {dateTime.format(new Date(sale.createdAt))}
      </p>
      <p className="mt-1 text-xs text-gray-600">Vendedor: {sellerName}</p>

      <hr className="my-2 border-dashed" />

      <table className="w-full">
        <tbody>
          {items.map((item, i) => (
            <tr key={`${item.productName}-${i}`}>
              <td className="py-0.5">
                {item.productName}
                <span className="text-gray-500"> × {item.quantity}</span>
              </td>
              <td className="py-0.5 text-right">
                {formatUsd(item.unitPrice * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="my-2 border-dashed" />

      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{formatUsd(sale.total)}</span>
      </div>
      <div className="mt-1 space-y-0.5 border-t border-dashed pt-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Base imponible</span>
          <span>{formatBsCents(baseBsCents)}</span>
        </div>
        <div className="flex justify-between">
          <span>IVA (16%)</span>
          <span>{formatBsCents(ivaBsCents)}</span>
        </div>
        <div className="flex justify-between font-semibold text-black">
          <span>Total Bs</span>
          <span>{formatBsCents(totalBsCents)}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-600">
        {paymentMethodLabel(sale.paymentMethod)} · tasa{' '}
        {formatRate(sale.exchangeRate)} Bs/$
      </p>
      {sale.reference && (
        <p className="text-xs text-gray-600">Referencia: {sale.reference}</p>
      )}
      <p className="mt-3 text-center text-xs text-gray-500">
        Ticket {sale.id.slice(0, 8)}
      </p>
    </div>
  );
}
