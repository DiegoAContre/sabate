import Link from 'next/link';
import { listTags } from '@/lib/tags';
import { TagSection } from './tag-section';

export default function ClasificacionPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/inventario" className="text-sm text-gray-500 hover:text-gray-900">
          ← Inventario
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Categorías y marcas</h1>
        <p className="mt-1 text-sm text-gray-600">
          Los productos eligen de estas listas, así los valores no se duplican.
          Ambas son opcionales al crear un producto.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <TagSection
          kind="category"
          title="Categorías"
          placeholder="Ej.: Zapato"
          items={listTags('category')}
        />
        <TagSection
          kind="brand"
          title="Marcas"
          placeholder="Ej.: adidas"
          items={listTags('brand')}
        />
      </div>
    </div>
  );
}
