'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RateForm() {
  const router = useRouter();
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(rate.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Tasa inválida');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: value }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'No se pudo guardar la tasa');
        return;
      }
      setRate('');
      router.refresh();
    } catch {
      setError('No se pudo guardar la tasa');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm items-end gap-2">
      <div>
        <label className="mb-1 block text-sm font-medium">
          Nueva tasa (Bs por $)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-40 rounded border border-gray-300 px-3 py-2"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Guardar'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
