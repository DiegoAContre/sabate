'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
    >
      Imprimir
    </button>
  );
}
