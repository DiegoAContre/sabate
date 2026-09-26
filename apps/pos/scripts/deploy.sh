#!/usr/bin/env bash
# Deploy del POS al server de la tienda.
# Corre desde la máquina de desarrollo (requiere SSH a $SERVER_USER@192.168.100.7).
# BACKUP_TOKEN=...  respalda la DB del server antes de subir código (recomendado).
# INIT_DB=1         (re)siembra la DB inicial admin/sabate8718 — ¡borra la del server!
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_HOST="${SERVER_HOST:-192.168.100.7}"
SERVER_USER="${SERVER_USER:-mirlaac}"
SSH_KEY="${SSH_KEY:-}"
SSH_CMD="ssh"
SCP_CMD="scp"
if [ -n "$SSH_KEY" ]; then
  SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
  SCP_CMD="scp -i $SSH_KEY -o StrictHostKeyChecking=no"
fi
REMOTE_ROOT=/opt/sabate-pos
REMOTE_APP=$REMOTE_ROOT/app
REMOTE_DB=/var/lib/sabate-pos/pos.db
STANDALONE="$APP_DIR/.next/standalone"
INIT_DB="$(mktemp -p /tmp pos-init-XXXX.db)"

echo "== build =="
(cd "$APP_DIR" && npm run build)

echo "== static dentro del standalone =="
rm -rf "$STANDALONE/apps/pos/.next/static"
cp -r "$APP_DIR/.next/static" "$STANDALONE/apps/pos/.next/static"

echo "== bundle tar (raiz del standalone: apps/ + node_modules/) =="
rm -f /tmp/pos-bundle.tgz
tar -C "$STANDALONE" --exclude='./apps/*/data' --exclude='./apps/*/.env' -czf /tmp/pos-bundle.tgz .

echo "== respaldo de la DB del server (antes de tocar nada) =="
if [ -z "${BACKUP_TOKEN:-}" ]; then
  echo "   BACKUP_TOKEN no definido: sin respaldo previo."
else
  $SSH_CMD "$SERVER_USER@$SERVER_HOST" \
    "curl -sS -X POST -H 'x-backup-token: ${BACKUP_TOKEN}' http://127.0.0.1/api/admin/backup"
  echo
fi

if [ "${INIT_DB:-}" = "1" ]; then
  echo "== INIT_DB=1: se sobrescribe la DB del server con una inicial =="
  echo "   schema..."
  node -e "
    const { Database } = require('node-sqlite3-wasm');
    const fs = require('fs');
    const db = new Database('$INIT_DB');
    db.exec('PRAGMA journal_mode = DELETE');
    for (const f of fs.readdirSync('$APP_DIR/drizzle').filter(f => f.endsWith('.sql')).sort())
      db.exec(fs.readFileSync('$APP_DIR/drizzle/' + f, 'utf8'));
    db.close();
  "
  echo "   owner..."
  SQLITE_PATH="$INIT_DB" \
  SEED_OWNER_USERNAME="${SEED_OWNER_USERNAME:-admin}" \
  SEED_OWNER_PASSWORD="${SEED_OWNER_PASSWORD:-sabate8718}" \
  npx tsx "$APP_DIR/scripts/seed.ts"
  $SCP_CMD "$INIT_DB" "$SERVER_USER@$SERVER_HOST:/tmp/pos-init.db"
  $SSH_CMD "$SERVER_USER@$SERVER_HOST" "sudo install -o pos -g pos -m 600 /tmp/pos-init.db $REMOTE_DB && rm -f /tmp/pos-init.db"
  echo "   DB inicial enviada."
else
  echo "== DB del server intacta (INIT_DB=1 solo para sembrarla la primera vez) =="
fi
rm -f "$INIT_DB"

echo "== subida del bundle =="
cat /tmp/pos-bundle.tgz | $SSH_CMD "$SERVER_USER@$SERVER_HOST" "sudo tar --no-same-owner -xzf - -C $REMOTE_ROOT"

echo "== restart =="
$SSH_CMD "$SERVER_USER@$SERVER_HOST" "sudo systemctl restart sabate-pos"
sleep 2

echo "== smoke =="
$SSH_CMD "$SERVER_USER@$SERVER_HOST" "sudo systemctl status sabate-pos | head -8"
$SSH_CMD "$SERVER_USER@$SERVER_HOST" "curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1/login"

echo "== listo: http://192.168.100.7/"