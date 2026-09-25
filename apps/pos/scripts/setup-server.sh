#!/usr/bin/env bash
# Setup inicial del servidor POS (correr UNA vez, como root).
# Idempotente: se puede re-correr sin romper nada.
# App: /opt/sabate-pos/app (root:root). Datos: /var/lib/sabate-pos (pos:pos).
set -euo pipefail

SERVER_HOST="${SERVER_HOST:-192.168.100.7}"
SERVER_USER="${SERVER_USER:-mirlaac}"
DEPLOY_USER="${DEPLOY_USER:-mirlaac}"

echo "== paquetes =="
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs curl rsync ufw

echo "== swap 1G =="
if ! grep -q '/swapfile' /etc/fstab; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== usuario pos =="
id -u pos >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin pos
getent group pos >/dev/null 2>&1 || groupadd pos
usermod -g pos pos
mkdir -p /opt/sabate-pos/app /var/lib/sabate-pos
chown -R pos:pos /var/lib/sabate-pos
chmod 750 /var/lib/sabate-pos

echo "== sudoers de deploy =="
# permite a $DEPLOY_USER solo: extraer tar + reiniciar el servicio
cat > /etc/sudoers.d/pos-deploy <<EOF
$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/tar --no-same-owner -xzf - -C /opt/sabate-pos/app
$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/install *
$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart sabate-pos
$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop sabate-pos
$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl start sabate-pos
$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl status sabate-pos
EOF
chmod 440 /etc/sudoers.d/pos-deploy
visudo -cf /etc/sudoers.d/pos-deploy

echo "== AUTH_SECRET y BACKUP_TOKEN (persistentes en /var/lib/sabate-pos/.env) =="
ENV_F=/var/lib/sabate-pos/.env
if [ ! -f "$ENV_F" ]; then
  AUTH_SECRET="$(openssl rand -hex 32)"
  BACKUP_TOKEN="$(openssl rand -hex 32)"
  printf 'AUTH_SECRET=%s\nBACKUP_TOKEN=%s\n' "$AUTH_SECRET" "$BACKUP_TOKEN" > "$ENV_F"
  chown pos:pos "$ENV_F"; chmod 600 "$ENV_F"
fi
. "$ENV_F"

echo "== unit systemd =="
cat > /etc/systemd/system/sabate-pos.service <<EOF
[Unit]
Description=Sabate POS
After=network.target

[Service]
Type=simple
User=pos
Group=pos
WorkingDirectory=/opt/sabate-pos/app
Environment=PORT=80
Environment=HOSTNAME=0.0.0.0
Environment=AUTH_SECRET=$AUTH_SECRET
Environment=SQLITE_PATH=/var/lib/sabate-pos/pos.db
Environment=BACKUP_DIR=/var/lib/sabate-pos/backups
Environment=BACKUP_TOKEN=$BACKUP_TOKEN
ExecStartPre=/bin/rm -f /var/lib/sabate-pos/pos.db.lock
ExecStart=/usr/bin/env node server.js
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable sabate-pos

echo "== cron backup diario =="
mkdir -p /etc/cron.d
cat > /etc/cron.d/sabate-pos <<EOF
0 3 * * * root curl -sS -X POST -H "x-backup-token: $BACKUP_TOKEN" http://127.0.0.1:80/api/admin/backup >/dev/null 2>&1
EOF
chmod 644 /etc/cron.d/sabate-pos

echo "== ufw =="
yes | ufw default deny incoming >/dev/null 2>&1 || true
yes | ufw allow from 192.168.100.0/24 to any port 22 proto tcp >/dev/null 2>&1 || true
yes | ufw allow from 192.168.100.0/24 to any port 80 proto tcp >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true
ufw status verbose

echo "== listo. Siguiente: correr deploy.sh (primera vez enviara la DB inicial) =="