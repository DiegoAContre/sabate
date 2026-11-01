# sabate

Punto de venta (POS) local para una tienda en Sabate, Valera (Trujillo).

Una sola aplicación, `apps/pos`, **autocontenida**: catálogo y stock propios en
SQLite, UI en español y API route handlers dentro de la app. Corre en un servidor
Debian headless de la tienda y el personal lo usa desde Firefox en la LAN.

## Stack

| Capa           | Tecnología                          |
| -------------- | ----------------------------------- |
| Frontend       | Next.js 15 (App Router)             |
| Estilos        | Tailwind CSS 4                      |
| Base de datos  | SQLite (`node-sqlite3-wasm`)        |
| ORM            | Drizzle                             |
| Auth           | JWT con `jose` en cookie httpOnly   |
| Validación     | Zod                                 |
| Tests          | Vitest                              |

## Getting Started

```bash
npm install
cp .env.example apps/pos/.env    # completa AUTH_SECRET y SEED_OWNER_*
npm run seed                     # crea el usuario dueño
npm run dev                      # http://localhost:3002
```

Comandos:

- `npm run dev` — servidor de desarrollo (puerto 3002)
- `npm run typecheck` — `tsc --noEmit` del workspace
- `npm run db:push` — aplica el schema Drizzle a la SQLite de desarrollo
- `npm run seed` — crea el usuario dueño desde `SEED_OWNER_*`
- `npm run test` — suite del POS (venta/anulación, tallas, tags, reportes)
- `npm run test:db-setup` — crea `apps/pos/data/pos-test.db` desde el SQL commiteado

## Features

- Página de venta: búsqueda por **nombre, código, marca o categoría**, grilla,
  selector de **talla** y ticket, **Pago Móvil** y transferencia con número de
  referencia (opcional), y desglose de **IVA (16 %) / base imponible** antes de cobrar
- Factura / reimpresión con el desglose de IVA, la tasa usada, el método, la
  referencia y la talla
- **Productos con código (opcional) y tallas**: cada talla tiene su existencia y
  el stock total es la suma de las tallas
- Tasa del día (Bs/$) con validez de 12 h; precios en USD y Bs derivados de la tasa
- Inventario con categorías y marcas; el usuario **vendedor** entra en modo solo lectura
- Ventas: totales por día y por método, filtro por fecha y anular (repone stock)
- Usuarios, stock bajo y backups diarios; UI escalada al 125 % para legibilidad

## Estructura

Todo vive en `apps/pos` (schema, cliente SQLite, lógica y pantallas). El detalle
de cada archivo y sus convenciones está en [`AGENTS.md`](./AGENTS.md).

## Deploy

Server Debian 12 headless en la LAN (`192.168.100.7`), systemd, puerto 80.

- `apps/pos/scripts/setup-server.sh` — una sola vez, como root: instala nodejs,
  crea swap, usuario `pos`, reglas de sudoers, la unidad de systemd, el cron de
  backups y ufw.
- `apps/pos/scripts/deploy.sh` — build standalone → tar por SSH → restart → smoke.
  **Nunca toca la DB** salvo `INIT_DB=1` (resiembre y la borra); pasa
  `BACKUP_TOKEN` para respaldar antes de subir.

La guía operativa completa (backups, restauración, incidente del 2026-09-26) está
en `AGENTS.md` y `Nextsteps.md`.

## License

Private
