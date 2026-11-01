# sabate

Punto de venta (POS) local: una sola app web autocontenida (`apps/pos`) con
catálogo y stock en SQLite, UI en español y API route handlers dentro de la app.

## Stack

| Capa               | Tecnología                               |
| ------------------ | ---------------------------------------- |
| App                | Next.js 15 (App Router) + Tailwind CSS 4 |
| Base de datos      | SQLite (`node-sqlite3-wasm`) + Drizzle   |
| Auth               | JWT (`jose`) en cookie httpOnly          |
| Validación / tests | Zod / Vitest                             |

## Getting Started

```bash
npm install
cp .env.example apps/pos/.env    # completa AUTH_SECRET y SEED_OWNER_*
npm run seed                     # crea el usuario dueño
npm run dev                      # http://localhost:3002
```

Comandos:

- `npm run dev` — servidor de desarrollo (puerto 3002)
- `npm run seed` — crea el usuario dueño
- `npm run db:push` — aplica el schema Drizzle a la SQLite de desarrollo
- `npm run test` — suite de tests
- `npm run test:db-setup` — crea la base de datos de tests (una sola vez)
- `npm run typecheck` — chequeo de tipos

## Features

- Página de venta: búsqueda, selector de talla, ticket y desglose de IVA
- Precios en USD con Bs derivados de la tasa del día
- Inventario con tallas, código, categorías y marcas
- Historial de ventas con reportes por día/método y anulación
- Usuarios con roles (dueño / vendedor)
- Respaldo diario de la base de datos

## Deploy

El build produce un bundle standalone (`output: 'standalone'`) que
`apps/pos/scripts/deploy.sh` sube por SSH y corre como servicio de systemd.
El setup del server, los respaldos y la restauración se documentan en
`AGENTS.md`.

## Docs

- `AGENTS.md` — arquitectura, convenciones y guía operativa detallada
- `Nextsteps.md` — historial de fases y pendientes

## License

Private
