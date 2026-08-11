#!/bin/bash
# ═══════════════════════════════════════════════════════════
# SMSLocal BSS v2 - VPS Deployment Script
# For: Hostinger KVM2 / Ubuntu 24.04 / Apache existing
# ═══════════════════════════════════════════════════════════

set -e

APP_DIR="/var/www/v2-smslocal-bss"
DOMAIN="v2.app.smslocal.com"
DB_NAME="smslocal_bss_v2"
DB_USER="smslocal_bss"
DB_PASS="SMSLocal@BSS2026!!"
NODE_PORT=3001
SMPP_PORT=2775

echo ""
echo "═══════════════════════════════════════════════════"
echo "  SMSLocal BSS v2 - Deployment"
echo "═══════════════════════════════════════════════════"

# ─── 1. System Update ─────────────────────────────────
echo ""
echo "[1/8] Updating system..."
apt update -y && apt install -y curl wget build-essential

# ─── 2. Install Node.js 22 ────────────────────────────
echo ""
echo "[2/8] Installing Node.js 22 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"
npm install -g pm2

# ─── 3. Install PostgreSQL ────────────────────────────
echo ""
echo "[3/8] Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

# Create DB + User
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -c "ALTER USER ${DB_USER} CREATEDB;"
echo "  Database '${DB_NAME}' ready."

# ─── 4. Configure Apache (reverse proxy) ──────────────
echo ""
echo "[4/8] Configuring Apache for ${DOMAIN}..."

# Enable required Apache modules
a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl 2>/dev/null || true
systemctl restart apache2

# Create VirtualHost for new app (port 80)
cat > /etc/apache2/sites-available/${DOMAIN}.conf << 'APACHE_EOF'
<VirtualHost *:80>
    ServerName v2.app.smslocal.com

    ProxyPreserveHost On
    ProxyRequests Off

    # Proxy all traffic to Next.js
    ProxyPass / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/

    # WebSocket/SSE support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteRule /(.*) ws://127.0.0.1:3001/$1 [P,L]

    # Headers
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"

    ErrorLog ${APACHE_LOG_DIR}/bss_v2_error.log
    CustomLog ${APACHE_LOG_DIR}/bss_v2_access.log combined
</VirtualHost>
APACHE_EOF

a2ensite ${DOMAIN}.conf 2>/dev/null || true
apache2ctl configtest && systemctl reload apache2
echo "  Apache configured. Existing app untouched."

# ─── 5. Setup Application ─────────────────────────────
echo ""
echo "[5/8] Setting up application..."

# Create .env with production credentials
SECRET=$(openssl rand -base64 32)
cat > ${APP_DIR}/.env << ENV_EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
NEXTAUTH_SECRET="${SECRET}"
NEXTAUTH_URL="http://${DOMAIN}"
NEXT_PUBLIC_APP_NAME="SMSLocal BSS"
NEXT_PUBLIC_APP_URL="http://${DOMAIN}"
PORT=${NODE_PORT}
SMPP_PORT=${SMPP_PORT}
ENV_EOF

cd ${APP_DIR}
npm install
echo "  Dependencies installed."

# ─── 6. Database Migration ─────────────────────────────
echo ""
echo "[6/8] Running database migration & seed..."
npx prisma generate
npx prisma db push --accept-data-loss
npx tsx prisma/seed.ts
echo "  Database ready with demo data."

# ─── 7. Build Next.js ─────────────────────────────────
echo ""
echo "[7/8] Building application..."
npm run build
echo "  Build complete."

# ─── 8. Start with PM2 ────────────────────────────────
echo ""
echo "[8/8] Starting services..."

cat > ${APP_DIR}/ecosystem.config.js << 'PM2_EOF'
module.exports = {
  apps: [
    {
      name: "smslocal-bss-web",
      script: "node_modules/.bin/next",
      args: "start -p 3001",
      cwd: "/var/www/v2-smslocal-bss",
      env: { NODE_ENV: "production", PORT: 3001 },
      instances: 1,
      autorestart: true,
      max_restarts: 20,
    },
    {
      name: "smpp-daemon",
      script: "node_modules/.bin/tsx",
      args: "src/workers/smpp-daemon.ts",
      cwd: "/var/www/v2-smslocal-bss",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      max_restarts: 50,
      restart_delay: 10000,
    },
    {
      name: "smpp-server",
      script: "node_modules/.bin/tsx",
      args: "src/workers/smpp-server.ts",
      cwd: "/var/www/v2-smslocal-bss",
      env: { NODE_ENV: "production", SMPP_PORT: 2775 },
      instances: 1,
      autorestart: true,
      max_restarts: 50,
    },
  ],
};
PM2_EOF

pm2 delete smslocal-bss-web 2>/dev/null || true
pm2 delete smpp-daemon 2>/dev/null || true
pm2 delete smpp-server 2>/dev/null || true

pm2 start ${APP_DIR}/ecosystem.config.js
pm2 save
pm2 startup 2>/dev/null || true

# Firewall
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw allow ${SMPP_PORT}/tcp 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  New App:     http://${DOMAIN}"
echo "  Existing:    https://v2.app.smslocal.in (unchanged)"
echo "  SMPP Port:   ${SMPP_PORT}"
echo "  Login:       admin / Admin@123"
echo ""
echo "  Next:"
echo "  1. Add DNS A record: v2.app.smslocal.com → 187.127.150.132"
echo "  2. SSL: certbot --apache -d ${DOMAIN}"
echo ""
echo "  pm2 status    - Check services"
echo "  pm2 logs      - View logs"
echo "═══════════════════════════════════════════════════"
