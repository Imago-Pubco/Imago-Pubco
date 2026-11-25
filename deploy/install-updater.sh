#!/usr/bin/env bash
# One-time install of the Imago updater (Administration › Système › Mise à jour).
#   cd /opt/imago-pubco && sudo bash deploy/install-updater.sh
# Creates .update/ (shared with the app container, writable by its "node" user), installs two systemd units
# (a path watcher and a one-shot service), and runs a first check.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
[ "$(id -u)" = 0 ] || { echo "Run with sudo."; exit 1; }
command -v flock >/dev/null || { echo "flock is required (apt install util-linux)."; exit 1; }

# git refuses repositories owned by another user unless they are marked safe.
git config --system --add safe.directory "$REPO" 2>/dev/null || true

mkdir -p "$REPO/.update"
chown 1000:1000 "$REPO/.update" # "node" user of the app container
chmod 750 "$REPO/.update"
chmod 750 "$REPO/deploy/imago-update.sh"

cat >/etc/systemd/system/imago-update.service <<EOF
[Unit]
Description=Imago update (requested from Administration > Systeme)
After=docker.service

[Service]
Type=oneshot
Environment=IMAGO_DIR=$REPO
ExecStart=/usr/bin/env bash $REPO/deploy/imago-update.sh
TimeoutStartSec=1800
EOF

cat >/etc/systemd/system/imago-update.path <<EOF
[Unit]
Description=Watch for Imago update requests

[Path]
PathChanged=$REPO/.update/request.json
Unit=imago-update.service

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now imago-update.path

# First check, so the page shows the current version right away.
echo '{"kind":"check","by":"installation"}' >"$REPO/.update/request.json"
chown 1000:1000 "$REPO/.update/request.json"
sleep 2
systemctl start imago-update.service || true
echo "Imago updater installed. Restart the app once so it sees the shared folder:"
echo "  cd $REPO && docker compose up -d"
