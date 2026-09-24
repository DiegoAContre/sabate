'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TagKind } from '@/lib/tags';
import { ConfirmDialog, Modal } from '../../modal';

interface Item {
  id: string;
  name: string;
}

export function TagSection({
  kind,
  title,
  placeholder,
  items,
}: {
  kind: TagKind;
  title: string;
  placeholder: string;
  items: Item[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [renaming, setRenaming] = useState<Item | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch(`/api/tags/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setAddError(data?.error ?? 'No se pudo agregar');
        return;
      }
      setName('');
      router.refresh();
    } catch {
      setAddError('No se pudo agregar');
    } finally {
      setAdding(false);
    }
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    setBusy(true);
    setRenameError('');
    try {
      const res = await fetch(`/api/tags/${kind}/${renaming.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setRenameError(data?.error ?? 'No se pudo guardar');
        return;
      }
      setRenaming(null);
      router.refresh();
    } catch {
      setRenameError('No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/tags/${kind}/${deleting.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(data?.error ?? 'No se pudo eliminar');
        return;
      }
      setDeleting(null);
      router.refresh();
    } catch {
      setDeleteError('No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>

      <ul className="mb-4 divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-sm">{item.name}</span>
            <button
              type="button"
              onClick={() => {
                setRenaming(item);
                setRenameValue(item.name);
                setRenameError('');
              }}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Renombrar
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleting(item);
                setDeleteError('');
              }}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Eliminar
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-3 text-sm text-gray-500">Aún no hay ninguna.</li>
        )}
      </ul>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
          required
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {adding ? '…' : 'Agregar'}
        </button>
      </form>
      {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}

      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Renombrar"
      >
        <form onSubmit={rename}>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          />
          {renameError && <p className="mt-2 text-sm text-red-600">{renameError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenaming(null)}
              disabled={busy}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eliminar"
        message={`¿Eliminar «${deleting?.name ?? ''}»? Solo se puede si ningún producto la usa.`}
        confirmLabel="Eliminar"
        danger
        loading={busy}
        error={deleteError}
        onConfirm={remove}
      />
    </section>
  );
}
