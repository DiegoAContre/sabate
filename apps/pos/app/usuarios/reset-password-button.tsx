'use client';

import { useState } from 'react';
import { Modal } from '@/app/modal';

export function ResetPasswordButton({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  function close() {
    setOpen(false);
    setPassword('');
    setError('');
    setDone(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'No se pudo cambiar la contraseña');
        return;
      }
      setDone(true);
      setPassword('');
    } catch {
      setError('No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-outline hover:bg-slate-50"
      >
        Contraseña
      </button>
      <Modal
        open={open}
        onClose={close}
        title={`Nueva contraseña para ${username}`}
      >
        {done ? (
          <div>
            <p className="text-sm text-green-700">Contraseña actualizada.</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="btn-primary hover:bg-brand-dark"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-slate-600">Nueva contraseña</span>
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
                {loading ? '…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
