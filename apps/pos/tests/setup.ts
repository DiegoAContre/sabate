import { fileURLToPath } from 'node:url';

// Runs before the test file's imports, so db/client connects to the test DB
// instead of the dev one (its default is data/pos.db).
process.env.SQLITE_PATH = fileURLToPath(
  new URL('../data/pos-test.db', import.meta.url),
);
