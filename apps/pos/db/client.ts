import path from 'node:path';
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
