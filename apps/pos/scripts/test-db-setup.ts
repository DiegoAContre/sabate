import fs from 'node:fs';
import path from 'node:path';
import { Database } from 'node-sqlite3-wasm';

// Builds the throwaway test DB from the committed migration SQL (the same way
// a fresh production DB is built). drizzle-kit push can't run here — the repo
// has no better-sqlite3/@libsql driver — and the app's startup migration takes
// care of the additive columns/tables when the tests first import db/client.
const file = path.resolve('data/pos-test.db');
fs.rmSync(file, { force: true });
fs.rmSync(`${file}.lock`, { recursive: true, force: true });

const db = new Database(file);
try {
  db.exec('PRAGMA journal_mode = DELETE');
  const dir = path.resolve('drizzle');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
} finally {
  db.close();
}

console.log(`Test DB created at ${file} (${fs.statSync(file).size} bytes).`);
