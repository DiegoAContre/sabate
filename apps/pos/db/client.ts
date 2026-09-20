import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'pos.db');

export const sqlite = new Database(dbPath);
// WAL survives power loss better; foreign_keys is off by default in SQLite.
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export * from './schema';
