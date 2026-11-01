# Next steps

> **El POS es el único track activo.** El e-commerce (apps/web, apps/api,
> packages/db) se eliminó del repo; su historial queda en git. Acá viven el
> estado del POS y lo que falta.

## POS local — estado

Sistema standalone para la tienda, **modelo de dos PCs**: un servidor Debian 12
headless (poca RAM) corre la app; el personal usa Firefox desde las cajas en
`http://<ip-del-server>`. Todo vive en `apps/pos`, UI en español, catálogo y stock
propios en SQLite. Roles: `owner` (todo) y `seller` (POS, stock-bajo y el
inventario completo en solo lectura). Métodos de pago: efectivo, tarjeta,
transferencia, pago móvil, cashea y otro (`transferencia`/`pago_movil` guardan una
referencia opcional). Vender más que la existencia bloquea con «Stock
insuficiente» (el dueño ajusta con `Ajuste`).

### Phase 1 — Scaffold + DB + auth — DONE (2026-09-20)

- Next.js 15 + Tailwind 4, API route handlers, Drizzle. La DB arrancó sobre
  better-sqlite3 y luego se pasó a `node-sqlite3-wasm` (ver Phase 5).
- Schema: users, products (CHECK stock >= 0), sales, sale_items (name/price
  snapshot), stock_movements (auditoría de venta/recepción/ajuste).
- Auth: login/logout route handlers, jose JWT en cookie httpOnly (30d),
  `middleware.ts` — `/login` + `/api/auth/*` públicos, el resto autenticado,
  `/inventario`, `/ventas`, `/usuarios` solo dueño (stock-bajo para vendedores).
- Seed: dueño desde `SEED_OWNER_USERNAME`/`SEED_OWNER_PASSWORD` (fail-fast, min 8).
- Verificado: login mal/bien, redirects con/sin sesión, vendedor bloqueado de
  rutas de dueño, logout limpia la sesión, typecheck OK.

### Phase 2 — Inventario + tasa del día — DONE (2026-09-20)

- **Schema**: `exchange_rates` (append-only, `bs_per_usd` en céntimos de Bs, quién
  la fijó) + `sales.exchange_rate` (snapshot). SQLite no permite ALTER ADD NOT
  NULL, así que las tablas de ventas vacías se recrearon; drizzle-kit se trabó
  contra el server dev → **parar el dev server antes de `db:push -w apps/pos`**.
- **Modelo de tasa**: precios en USD; los Bs se derivan de la tasa del día; una
  tasa vale **12 horas** (`lib/rate.ts`) — el POS se niega a vender con tasa
  vencida o inexistente. `/tasa` (dueño): actual + vigencia + historial;
  `POST /api/exchange-rate` agrega.
- **Inventario** (`/inventario`, dueño): tabla con $ y Bs, stock en rojo al llegar
  al umbral; modales — Nuevo producto (stock inicial deja movimiento
  `recepcion`), Editar, **Stock** (Recepción = +N / Ajuste = total contado, delta
  automático), Desactivar/Activar. Los productos se desactivan, nunca se borran.
  `app/modal.tsx` compartido (native `<dialog>`, ESC-safe).
- **Stock bajo** (`/inventario/stock-bajo`, también vendedores): productos activos
  en o bajo el umbral, solo lectura.
- **Gotcha**: las transacciones de drizzle con better-sqlite3 son sincrónicas —
  los callbacks `async` lanzan y pueden dejar filas commiteadas. Todos los
  handlers usan `.all()`/`.get()`/`.run()`.
- **Verificado**: typecheck; curl — alta (201 + movimiento), recepción +3, ajuste
  set-7 (delta −6), PATCH precio/desactivar, vendedor 403 en mutaciones y GET
  permitido; páginas renderizan; vendedor redirigido de /inventario y /tasa.

### Phase 3 — Pantalla de venta — DONE (2026-09-21)

- **Pantalla** (`/`, dueño y vendedor): búsqueda por nombre/código/marca/categoría,
  grilla (click agrega; deshabilitado en «Sin stock»), ticket con cantidad −/+ y
  quitar, total en **$ y Bs**, método de pago y `Cobrar`. Al cobrar muestra el
  recibo (impresión del navegador vía `window.print()`) + «Nueva venta»;
  `router.refresh()` recarga existencias.
- **API de venta** `POST /api/sales` (cualquier rol logueado): zod; precios y
  total se calculan **dentro** de la transacción desde el catálogo; la tasa se
  revalida en el servidor; decremento condicional por talla y un
  `stock_movements` por línea (`venta`).
- **Reglas**: sin tasa válida no hay venta → 409 (el POS avisa «Actualizar tasa»
  al dueño y «Avisa al propietario» al vendedor); una línea sin stock rechaza todo
  el ticket (409, sin escrituras parciales); producto inactivo → 409.
- **Tests**: `apps/pos/tests/sale.test.ts` contra `data/pos-test.db`.
- Decisiones (cliente): solo método de pago (sin vuelto); sin escáner; recibo
  mínimo (nombre, fecha, vendedor, líneas, $ + Bs, tasa, método, id corto, talla).

### Phase 4 — Historial de ventas + usuarios — DONE (2026-09-21)

- **/ventas (dueño)**: filtro por rango de fechas (form GET, «Hoy» resetea),
  resumen del período en $ y Bs, cantidad de ventas y anuladas, desglose **por
  día** y **por método**, y la lista (fecha, vendedor, método, $ + Bs, estado,
  tope 500 filas).
- **Números**: `lib/day.ts` corta el día en **America/Caracas** (UTC−4, sin DST);
  `lib/report.ts::summarize()` convierte cada venta a **su propia tasa
  snapshoteada** (cuadra con los tickets) y **deja fuera las anuladas**.
- **/ventas/[id]**: líneas (producto, cantidad, precio, subtotal), tasa usada, el
  recibo imprimible (reusa `app/receipt.tsx`) y **«Anular venta»** (repone stock +
  movimiento `anulacion` + marca la venta; la fila nunca se borra).
- **/usuarios (dueño)**: crear vendedores, resetear contraseña, activar/desactivar.
  Los usuarios nunca se borran; no podés desactivarte a vos mismo y se conserva el
  último dueño activo.
- **Guards**: `/ventas/*` en la regla owner-only del middleware; anular y usuarios
  revalidan el rol en el handler.
- **Schema**: `sales.voided_at`/`voided_by` + `anulacion` en
  `stock_movements.reason`, aplicado con `ALTER TABLE` a mano (ver gotcha de
  drizzle-kit en AGENTS.md).

### Phase 4b — Categorías y marcas — DONE (2026-09-23)

- **Tablas** `categories` y `brands` (+ `products.category_id`/`brand_id`,
  nullable). `lib/tags.ts` concentra las reglas y un mapa
  `kind → (tabla, columna FK)`.
- **Guards**: nombre único ignorando mayúsculas/espacios (409); **no se puede
  borrar un valor en uso** (409) — se renombra; ids inexistentes o del tipo
  equivocado dan 404/400, nunca un 500 del FK.
- **`/inventario/clasificacion`**: dos secciones con lista, agregar, renombrar y
  eliminar con confirmación.
- **Producto**: los modales cambian el input SKU por dos `<select>`; el inventario
  muestra ambas columnas; el POS busca por nombre/marca/categoría.
- **Tests**: `tests/tags.test.ts` (alta, duplicado case-insensitive, renombrar +
  choque, 404 al borrar inexistente, borrar en uso vs libre).

### Phase 5 — Deploy en Debian (dos PCs) — DONE (2026-09-25)

Server Debian 12 headless, **poca RAM** (Atom N270 de 32 bits, 988 MB + 1 GB swap),
sin git/build en la caja → se sube un bundle standalone precompilado.

- `output: 'standalone'` + `serverExternalPackages: ['node-sqlite3-wasm']` +
  `outputFileTracingIncludes` para el `.wasm`. **Motor `node-sqlite3-wasm`, no
  better-sqlite3**: la caja es i686 y no hay prebuilds; el WASM es neutral de
  arquitectura — verificado en Node 18.20.4. El tar se hace de la **raíz de
  `.next/standalone/`** (`apps/` + `node_modules/` juntos) y el `WorkingDirectory`
  es `/opt/sabate-pos/apps/pos`.
- **deploy.sh**: build → copia `.next/static` al standalone → tar → `sudo tar
  --no-same-owner -xzf - -C /opt/sabate-pos` → `sudo systemctl restart
  sabate-pos` → smoke. **Nunca toca la DB salvo `INIT_DB=1`**; con `BACKUP_TOKEN`
  respalda **antes** de subir.
- **setup-server.sh** (idempotente, una vez, root): nodejs/sudo/rsync/curl/ufw,
  swap de 1 GB, usuario `pos`, `/etc/sudoers.d/pos-deploy` (solo tar/install/
  systemctl), unidad systemd, cron de backup y ufw. Secretos
  (`AUTH_SECRET`, `BACKUP_TOKEN`) via `openssl rand` en `/var/lib/sabate-pos/.env`
  (solo root) — **nunca en el repo**.
- **Layout verificado tras reboot**: `sabate-pos.service` `enabled`, `User=pos`,
  `PORT=80` + `HOSTNAME=0.0.0.0` + `CAP_NET_BIND_SERVICE`, `ExecStartPre` borra un
  `pos.db.lock` viejo. DB en `/var/lib/sabate-pos/pos.db`; backups en
  `/var/lib/sabate-pos/backups/`; ufw permite 22/80 solo desde
  `192.168.100.0/24`.
- **Backups**: el VFS bloquea la DB con `<db>.lock`, así que ningún proceso
  externo puede abrirla — la única vía es `POST /api/admin/backup` (sesión de
  dueño o `x-backup-token`), que usa una **segunda conexión in-process** para
  `VACUUM INTO` y poda a 30 días.
- **Riesgo aceptado**: HTTP plano en la LAN (sin dominio no hay TLS) — la cookie
  de sesión es olfateable en la LAN. Aceptable para una tienda pequeña.
- **Incidente 2026-09-26 (error propio, ya imposible)**: el deploy decidía si
  existía la DB con `test -f /var/lib/sabate-pos/pos.db` por SSH como `mirlaac`,
  que no puede atravesar ese directorio (700 `pos:pos`) — siempre decía «no hay
  DB» y resembraba, borrando el catálogo. Regla: **nunca decidir nada sobre
  `/var/lib/sabate-pos` desde un shell de `mirlaac`**; el deploy ahora no toca la
  DB por defecto (`INIT_DB=1`).

### Phase 6 — UI responsive (móvil) — DONE (2026-09-26)

El personal lo usa tanto desde el teléfono como desde la PC de la caja, así que el
shell y las tablas anchas tenían que aguantar 375 px.

- **`app/nav.tsx` + `app/nav-drawer.tsx`**: `linksFor()` es la única fuente del
  menú por rol (espeja `OWNER_ONLY` del middleware) y se renderiza dos veces —
  fila `hidden md:flex` y hamburguesa + `<dialog>` debajo de `md`.
- **Tablas anchas**: cada `<table>` (salvo `receipt.tsx` y el ticket del POS) vive
  en un `overflow-x-auto` con `min-w-*` por tabla; scroll horizontal nativo en vez
  de reescribir ocho tablas como tarjetas.
- **`app/pos-screen.tsx`**: el bloque Total/Método/Cobrar es `fixed` abajo en
  móvil y `lg:static` dentro del ticket en desktop (mismo markup/estado); buscador
  `sticky`, ticket `lg:sticky`, `pb-52 lg:pb-0` para que la barra no tape el
  catálogo.
- Verificado en producción (`http://192.168.100.7`).

### Phase 7 — Código de producto + tallas — DONE (2026-10-14)

- **DB**: `products.code` (texto libre, opcional, buscable, no único) y tabla
  `product_sizes` (talla como texto normalizado a mayúsculas, `CHECK quantity >=
  0`, única por producto); `sale_items.size` y `stock_movements.size`. Un producto
  sin tallas reales usa una fila «ÚNICA». `products.stock` queda como **caché de
  `SUM(product_sizes.quantity)`**, recomputado en la misma transacción en cada
  alta/edición/recepción/ajuste/venta/anulación.
- **Migración**: `db/client.ts` agrega las columnas y crea `product_sizes` al
  arrancar (idempotente, se salta durante `next build`) y hace backfill de cada
  producto existente a «ÚNICA» con su stock.
- **Lógica**: `lib/product.ts` (alta/edición/reconcile/recepción/ajuste por talla)
  y `lib/sale.ts` (descuento atómico por talla, anulación repone la talla).
- **UI**: selector de talla en el POS (con existencias por talla), búsqueda por
  código, talla en ticket y detalle; inventario con columnas Código/Tallas,
  editor de tallas en alta/edición y modal de stock por talla; stock-bajo muestra
  código y desglose.
- **Tests**: 31 en verde (venta por talla, tope por talla, rollback, anulación
  repone, `total === suma de tallas`, helpers de producto).
- **Deploy verificado**: respaldo `pos-2026-10-14.db`; migración aplicada sobre la
  DB real (3 productos backfilled a «ÚNICA», `integrity_check: ok`), servicio
  activo, `/login` 200 y bundle nuevo confirmado.

### Phase 8 — Factura: categoría y limpieza — DONE (2026-11-01)

- **Snapshot de categoría**: `sale_items.category` se guarda en cada línea de la
  venta (null si el producto no tiene categoría); migración de arranque + backfill
  de las ventas viejas con la categoría actual del producto.
- **Líneas «Categoría - Nombre»** en el detalle de `/ventas/[id]`, en la factura
  (preview e impresión) y en el carrito del POS; sin categoría, solo el nombre.
- **Factura orientada al cliente**: fuera «Vendedor» y «tasa … Bs/$» (quedan en
  pantalla en el detalle como tarjetas `no-print`); se mantienen fecha, líneas
  con talla, $ + Bs, base imponible/IVA, método, referencia y `Ticket id`.
- **Gotcha**: un join `products × categories` devuelve dos columnas `name` y la
  sesión de node-sqlite3-wasm (filas por nombre de columna) las colapsa — la
  categoría se resuelve con una segunda query dentro de la transacción.
- **Tests**: 32 en verde (snapshot con y sin categoría); E2E local verificado
  (respuesta con categoría, detalle y factura renderizando «Categoría - Nombre»,
  sin «Vendedor:» ni «tasa», fallback a solo nombre).

### Phase 9 — Búsqueda y orden en inventario — DONE (2026-11-01)

- **Búsqueda** en `/inventario` con form GET (`?q=`) estilo `/ventas`: nombre,
  código, marca o categoría (mismo criterio que el POS), case-insensitive, con
  «Buscar», «Limpiar» y contador de resultados; el form conserva el orden activo.
- **Orden por columnas** Nombre, Categoría, Marca y Estado: headers como links
  `?sort=…&dir=…` (primer click asc, siguiente invierte), indicador ▲/▼,
  whitelist server-side, default nombre asc y links que preservan `q`.
- **Implementado en la página** (fetch completo + filtro/orden en memoria): evita
  el gotcha del join `products × categories` con dos columnas `name`. Sirve igual
  al vendedor (solo lectura). E2E local verificado (default, orden asc/desc por
  categoría y nombre, búsqueda por nombre/código/marca, sin resultados, params
  inválidos → default).

## Pendiente (planificar después)

- **Correcciones de diseño** — por definir con el cliente.

## Próximos pasos — mejorar el sistema de backups (IDEA, sin ejecutar)

Hoy el respaldo es: cron 03:00 → `POST /api/admin/backup` → `VACUUM INTO` en
`/var/lib/sabate-pos/backups/pos-AAAA-MM-DD.db`, retención 30 días. El deploy
2026-09-26 dejó ver los huecos (no había copia del día porque la caja estaba
apagada a las 03:00, y el restore se improvisó a mano). Candidatos, de más barato
a más pesado:

1. **Respaldo que no se pierda por apagón**: sustituir la línea de
   `/etc/cron.d/sabate-pos` por un *systemd timer* con `Persistent=true`
   (`OnCalendar=*-*-* 03:00` + `OnBootSec=5min`), así el respaldo del día corre en
   cuanto arranca la caja aunque se haya perdido la hora. Coste: ~10 líneas en
   `setup-server.sh`.
2. **`deploy.sh` con BACKUP_TOKEN obligatorio**: hoy avisa si falta; que falle en
   seco (`set -e` + mensaje) para que ningún deploy pase sin snapshot previo.
3. **Generaciones con hora y guarda anti-vacío**: snapshots `pos-<día>-<HHMM>`
   antes de cada deploy, y que el respaldo no sobrescriba al del mismo día si la
   DB a copiar está vacía (0 productos) cuando la anterior no lo estaba.
4. **Verificación al respaldar**: que la ruta devuelva conteos
   (productos/ventas/movimientos) y `PRAGMA integrity_check` de la copia.
5. **Copia fuera de la caja**: `rsync`/`scp` diario a otro equipo de la LAN (o un
   USB montado en el server) para sobrevivir a la falla del disco o del equipo.
6. **`scripts/restore.sh`**: `stop` → `sudo install -o pos -g pos -m 600 <copia>
   /var/lib/sabate-pos/pos.db` → `start` (con lista de copias disponibles), y
   probarlo de vez en cuando. Un respaldo que nunca se restauró es un respaldo que
   no existe.

> Recordatorio operativo: `mirlaac` no puede leer `/var/lib/sabate-pos`, así que
> cualquier copia de la DB se saca con `sudo install` (permitido en sudoers) y la
> lista de copias solo se obtiene probando nombres.
