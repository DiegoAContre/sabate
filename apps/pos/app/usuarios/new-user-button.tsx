'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/app/modal';

export function NewUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setOpen(false);
    setUsername('');
    setName('');
    setPassword('');
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'No se pudo crear el usuario');
        return;
      }
      close();
      router.refresh();
    } catch {
      setError('No se pudo crear el usuario');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary hover:bg-brand-dark"
      >
        Nuevo vendedor
      </button>
      <Modal open={open} onClose={close} title="Nuevo vendedor">
        <form onSubmit={submit}>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-slate-600">Usuario</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1.5"
              required
            />
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-slate-600">Nombre</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1.5"
              required
            />
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-slate-600">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1.5"
              minLength={8}
              required
            />
            <span className="mt-1 block text-xs text-slate-500">
              Mínimo 8 caracteres.
            </span>
          </label>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="btn-outline hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? '…' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
