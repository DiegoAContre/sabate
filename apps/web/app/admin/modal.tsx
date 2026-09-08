'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="rounded-lg p-0 shadow-lg backdrop:bg-black/50"
    >
      <div className="w-80 max-w-[90vw] p-6">
        <h3 className="mb-2 text-base font-bold">{title}</h3>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title={title}>
      <p className="text-sm text-gray-600">{message}</p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={
            danger
              ? 'rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50'
              : 'rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50'
          }
        >
          {loading ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
