import { asc } from 'drizzle-orm';
import { db, users } from '@/db/client';
import { CARACAS_TZ } from '@/lib/day';
import { NewUserButton } from './new-user-button';
import { ResetPasswordButton } from './reset-password-button';
import { UserStatusButton } from './user-status-button';

const dateFmt = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'short',
  timeZone: CARACAS_TZ,
});

export default async function UsuariosPage() {
  const all = await db.select().from(users).orderBy(asc(users.username));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <NewUserButton />
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Los vendedores pueden vender y ver el stock bajo. Los usuarios se
        desactivan, nunca se borran, para no perder el historial de ventas.
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2">Usuario</th>
            <th className="py-2">Nombre</th>
            <th className="py-2">Rol</th>
            <th className="py-2">Estado</th>
            <th className="py-2">Creado</th>
            <th className="py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {all.map((u) => (
            <tr key={u.id} className="border-b border-gray-100">
              <td className="py-2 font-medium">{u.username}</td>
              <td className="py-2">{u.name}</td>
              <td className="py-2">
                {u.role === 'owner' ? 'propietario' : 'vendedor'}
              </td>
              <td className="py-2">
                {u.isActive ? (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    activo
                  </span>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    inactivo
                  </span>
                )}
              </td>
              <td className="py-2 text-gray-600">{dateFmt.format(u.createdAt)}</td>
              <td className="py-2">
                <div className="flex justify-end gap-2">
                  <ResetPasswordButton userId={u.id} username={u.username} />
                  <UserStatusButton
                    userId={u.id}
                    username={u.username}
                    isActive={u.isActive}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
