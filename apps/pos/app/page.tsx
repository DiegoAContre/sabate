import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Placeholder home — becomes the POS sale screen in phase 3.
export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div>
      <h1 className="text-2xl font-bold">Punto de venta</h1>
      <p className="mt-2 text-gray-600">
        Hola, {session.name}. La pantalla de venta llegará en la fase 3.
      </p>
    </div>
  );
}
