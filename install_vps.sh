#!/usr/bin/env bash
# Install website nokos di VPS Ubuntu/Debian sebagai service (jalan 24 jam, auto-restart, nyala lagi setelah reboot).
# Pakai:  cd folder-web && sed -i 's/\r$//' install_vps.sh .env && bash install_vps.sh
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_USER="$(whoami)"
cd "$APP_DIR"
sed -i 's/\r$//' .env 2>/dev/null || true

if [ ! -f .env ]; then
  echo "File .env belum ada. Salin .env.example jadi .env lalu isi dulu."; exit 1
fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "==> Install Node.js 22..."
  sudo apt-get update -y
  sudo apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Install library..."
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

echo "==> Build..."
npm run build

PORT_VAL=$(grep -E '^PORT=' .env | cut -d= -f2); PORT_VAL=${PORT_VAL:-3000}
echo "==> Membuat service nokosweb (port $PORT_VAL)..."
sudo tee /etc/systemd/system/nokosweb.service >/dev/null <<EOF
[Unit]
Description=Website Nokos (Next.js)
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT_VAL
ExecStart=$(command -v node) $APP_DIR/node_modules/next/dist/bin/next start -p $PORT_VAL
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo timedatectl set-timezone Asia/Jakarta 2>/dev/null || true
sudo systemctl daemon-reload
sudo systemctl enable --now nokosweb
sudo systemctl restart nokosweb
sleep 5
curl -s -m 5 "http://localhost:$PORT_VAL/sehat" && echo "  <- website hidup"
echo
echo "SELESAI. Perintah berguna:"
echo "  Lihat log    : sudo journalctl -u nokosweb -f"
echo "  Restart      : sudo systemctl restart nokosweb"
echo "  Update kode  : npm ci && npm run build && sudo systemctl restart nokosweb"
echo
echo "Langkah berikutnya: hubungkan domain lewat Cloudflare Tunnel (lihat README.md)."
