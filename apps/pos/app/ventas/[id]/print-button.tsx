'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-primary hover:bg-brand-dark"
    >
      Imprimir
    </button>
  );
}
