import fs from 'node:fs';
import path from 'node:path';
import { Database } from 'node-sqlite3-wasm';
import { NextResponse, type NextRequest } from 'next/server';
import { sqlite } from '@/db/client';
import { getSession } from '@/lib/auth';

// Daily safety net, called by cron with BACKUP_TOKEN. The file lock means no
// other process can open the DB, so the copy has to run inside the app — and on
// a second connection, because sqlite refuses VACUUM while any statement of the
// live one is still open.
const RETENTION_DAYS = 30;

export async function POST(req: NextRequest) {
  const session = await getSession();
  const token = req.headers.get('x-backup-token');
  const configured = process.env.BACKUP_TOKEN;
  const authorized =
    session?.role === 'owner' || (configured && token === configured);
  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const dbPath = process.env.SQLITE_PATH ?? path.join(process.cwd(), 'data', 'pos.db');
  const dir = process.env.BACKUP_DIR ?? path.join(process.cwd(), 'data', 'backups');
  const target = path.join(dir, `pos-${new Date().toISOString().slice(0, 10)}.db`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(target)) {
      const copy = new Database(dbPath);
      try {
        copy.exec(`VACUUM INTO '${target}'`);
      } finally {
        copy.close();
      }
    }
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.db')) continue;
      const full = path.join(dir, file);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
    return NextResponse.json({ file: path.basename(target) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo respaldar' },
      { status: 500 },
    );
  }
}
