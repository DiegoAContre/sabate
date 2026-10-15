import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Database } from 'node-sqlite3-wasm';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type-only, erased at build
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { BaseSQLiteDatabase, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { BetterSQLiteSession } from 'drizzle-orm/better-sqlite3/session';
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from 'drizzle-orm/relations';
import * as schema from './schema';

const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'pos.db');

// One connection per process: this VFS locks the whole file with a `<db>.lock`
// directory, and each Next route is its own bundle (its own module instance).
const globalForDb = globalThis as unknown as { sqlite?: Database };
export const sqlite = globalForDb.sqlite ?? new Database(dbPath);
globalForDb.sqlite = sqlite;

// No WAL here, so a second connection (other route bundle, backup) waits its
// turn instead of failing with SQLITE_BUSY.
sqlite.exec('PRAGMA foreign_keys = ON');
sqlite.exec('PRAGMA busy_timeout = 5000');

type QueryResult = Record<string, unknown>;
type Stmt = ReturnType<Database['prepare']>;
type Params = unknown[];

// ponytail: prepares and finalizes on every use instead of caching statements —
// sqlite refuses `VACUUM INTO` (our backup) while any statement is in progress,
// and this DB is tiny. Also implements only the better-sqlite3 surface drizzle
// calls (all/get/run/raw + transaction), so the app keeps its sync calls.
function use<T>(sql: string, fn: (stmt: Stmt) => T): T {
  const stmt = sqlite.prepare(sql);
  try {
    return fn(stmt);
  } finally {
    stmt.finalize();
  }
}

// Forward migrations for additive changes: drizzle-kit can't evolve an existing
// SQLite DB here and external tools can't open the file while the VFS holds it,
// so the app applies them on startup with its own connection (idempotent).
// Skipped during `next build`: page-data collection opens one connection per
// route bundle in parallel and the writes race against the VFS lock.
function hasTable(name: string) {
  return Boolean(
    use(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      (stmt) => stmt.get([name]),
    ),
  );
}

function tableColumns(table: string) {
  return (
    use(`PRAGMA table_info(${table})`, (stmt) => stmt.all()) as unknown as {
      name: string;
    }[]
  ).map((c) => c.name);
}

function addColumn(table: string, column: string, ddl: string) {
  if (!hasTable(table) || tableColumns(table).includes(column)) return;
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  } catch (err) {
    // Another connection (a parallel route bundle) may have won the race.
    if (!String(err).includes('duplicate column name')) throw err;
  }
}

if (process.env.NEXT_PHASE !== 'phase-production-build') {
  addColumn('sales', 'reference', 'reference text');
  addColumn('products', 'code', 'code text');
  addColumn('sale_items', 'size', 'size text');
  addColumn('stock_movements', 'size', 'size text');

  // Per-size stock; every product ends up with at least one size row.
  sqlite.exec(`CREATE TABLE IF NOT EXISTS product_sizes (
    id text PRIMARY KEY NOT NULL,
    product_id text NOT NULL,
    size text NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    created_at integer NOT NULL,
    CONSTRAINT product_sizes_quantity_non_negative CHECK(quantity >= 0),
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE no action ON DELETE cascade
  )`);
  sqlite.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS product_sizes_product_size_idx ON product_sizes (product_id, size)',
  );

  // Backfill: every existing product gets a «ÚNICA» size carrying its stock.
  if (hasTable('products')) {
    const missing = use(
      `SELECT p.id AS id, p.stock AS stock FROM products p
       LEFT JOIN product_sizes s ON s.product_id = p.id
       WHERE s.id IS NULL`,
      (stmt) => stmt.all(),
    ) as unknown as { id: string; stock: number }[];
    for (const row of missing) {
      use(
        `INSERT OR IGNORE INTO product_sizes (id, product_id, size, quantity, created_at)
         VALUES (?, ?, 'ÚNICA', ?, ?)`,
        (stmt) => stmt.run([randomUUID(), row.id, row.stock, Date.now()]),
      );
    }
  }
}

class RawStatement {
  constructor(private sql: string) {}

  get(...params: Params) {
    const row = use(this.sql, (stmt) => stmt.get(params as never)) as
      | QueryResult
      | null;
    return row ? Object.values(row) : undefined;
  }

  all(...params: Params) {
    return use(this.sql, (stmt) =>
      stmt.all(params as never).map((row) => Object.values(row as QueryResult)),
    );
  }
}

class Statement {
  constructor(private sql: string) {}

  run(...params: Params) {
    return use(this.sql, (stmt) => stmt.run(params as never));
  }

  get(...params: Params) {
    return (
      (use(this.sql, (stmt) => stmt.get(params as never)) as QueryResult | null) ??
      undefined
    );
  }

  all(...params: Params) {
    return use(this.sql, (stmt) => stmt.all(params as never));
  }

  raw() {
    return new RawStatement(this.sql);
  }
}

let depth = 0;

const client = {
  prepare(sql: string) {
    return new Statement(sql);
  },
  // Mirrors better-sqlite3: BEGIN … COMMIT at the top level, SAVEPOINT nested.
  transaction(fn: (tx: unknown) => unknown) {
    const begin = (kind: string) => (tx: unknown) => {
      const nested = depth > 0;
      depth += 1;
      sqlite.exec(nested ? `SAVEPOINT sp${depth}` : `BEGIN ${kind}`);
      try {
        const result = fn(tx);
        sqlite.exec(nested ? `RELEASE sp${depth}` : 'COMMIT');
        return result;
      } catch (err) {
        sqlite.exec(nested ? `ROLLBACK TO sp${depth}` : 'ROLLBACK');
        if (nested) sqlite.exec(`RELEASE sp${depth}`);
        throw err;
      } finally {
        depth -= 1;
      }
    };
    return {
      deferred: begin('DEFERRED'),
      immediate: begin('IMMEDIATE'),
      exclusive: begin('EXCLUSIVE'),
    };
  },
};

// drizzle's own better-sqlite3 entry point imports the native package, so we
// wire the session by hand — same two calls it does internally.
const dialect = new SQLiteSyncDialect();
const tablesConfig = extractTablesRelationalConfig(
  schema,
  createTableRelationsHelpers,
);
const relationalSchema = {
  fullSchema: schema,
  schema: tablesConfig.tables,
  tableNamesMap: tablesConfig.tableNamesMap,
};
const session = new BetterSQLiteSession(
  client as never,
  dialect,
  relationalSchema as never,
);

export const db = new BaseSQLiteDatabase(
  'sync',
  dialect,
  session as never,
  relationalSchema as never,
) as unknown as BetterSQLite3Database<typeof schema>;

export * from './schema';
