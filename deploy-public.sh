#!/bin/bash

# Public Repository Deployment Script for Hetzner
set -e

# Configuration
SERVER_IP="91.98.94.41"
SERVER_USER="root"
APP_DIR="/var/www/shipapp-demo"
REPO_URL="https://github.com/horiaq/shipapp-demo.git"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[*]${NC} $1"
}

# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

print_status "Starting deployment to $SERVER_IP..."

# Deploy to server
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP bash -s << DEPLOY_SCRIPT
set -e

echo "===== Updating system packages ====="
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

echo "===== Installing Node.js 20.x ====="
if ! command -v node &> /dev/null || [ "\$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt "20" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "===== Installing PostgreSQL ====="
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
fi

echo "===== Installing Nginx ====="
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
fi

echo "===== Installing tools ====="
apt-get install -y git curl build-essential

echo "===== Installing PM2 ====="
npm install -g pm2 || true

echo "===== Setting up PostgreSQL database ====="
sudo -u postgres psql << 'PSQL_EOF'
DROP DATABASE IF EXISTS shipapp_db;
DROP USER IF EXISTS shipapp_admin;

CREATE DATABASE shipapp_db;
CREATE USER shipapp_admin WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE shipapp_db TO shipapp_admin;
ALTER DATABASE shipapp_db OWNER TO shipapp_admin;
PSQL_EOF

echo "===== Cloning public repository ====="
rm -rf $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR

echo "===== Setting up backend environment ====="
cat > $APP_DIR/.env << 'ENV_EOF'
PORT=3001
DATABASE_URL=postgresql://shipapp_admin:$DB_PASSWORD@localhost:5432/shipapp_db
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
FRONTEND_URL=http://$SERVER_IP
EOF

echo "===== Installing backend dependencies ====="
npm install --production

echo "===== Setting up frontend environment ====="
cat > $APP_DIR/frontend/.env.local << 'FRONTEND_ENV_EOF'
NEXT_PUBLIC_API_URL=http://$SERVER_IP:3001
EOF

echo "===== Installing frontend dependencies ====="
cd $APP_DIR/frontend
npm install

echo "===== Building frontend ====="
npm run build

echo "===== Running database migrations ====="
cd $APP_DIR

for sql_file in database-setup.sql \
                database-auth-system.sql \
                database-workspaces-migration.sql \
                database-multi-workspace-migration.sql \
                database-oblio-migration.sql \
                database-order-status-migration.sql \
                database-shopify-delivery-migration.sql \
                database-tracking-migration.sql \
                database-workspace-settings-migration.sql; do
    if [ -f "\$sql_file" ]; then
        echo "Running \$sql_file..."
        sudo -u postgres psql -d shipapp_db -f "\$sql_file" 2>&1 || echo "Warning: \$sql_file may have errors"
    fi
done

echo "===== Setting up PM2 ====="
cd $APP_DIR

# Stop existing processes
pm2 delete shipapp-backend 2>/dev/null || true
pm2 delete shipapp-frontend 2>/dev/null || true

# Start backend
pm2 start server.js --name shipapp-backend --time

# Start frontend
cd frontend
pm2 start npm --name shipapp-frontend -- start

# Save configuration
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "===== Configuring Nginx ====="
cat > /etc/nginx/sites-available/shipapp-demo << 'NGINX_EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_EOF

# Enable site
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/shipapp-demo /etc/nginx/sites-enabled/

# Test and restart Nginx
nginx -t
systemctl restart nginx

echo "===== Configuring firewall ====="
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'

echo "===== Deployment complete! ====="
DEPLOY_SCRIPT

print_status "======================================"
print_status "Deployment completed successfully!"
print_status "======================================"
echo ""

# Save credentials locally
cat > deployment-credentials.txt << CRED_EOF
Shipapp Demo Deployment Credentials
Generated: $(date)
Server: $SERVER_IP

Database Password: $DB_PASSWORD
JWT Secret: $JWT_SECRET
Session Secret: $SESSION_SECRET

Database Connection String:
postgresql://shipapp_admin:$DB_PASSWORD@localhost:5432/shipapp_db

Frontend URL: http://$SERVER_IP
Backend API: http://$SERVER_IP/api

SSH Command: ssh root@$SERVER_IP
CRED_EOF

print_warning "Credentials saved to: deployment-credentials.txt"
echo ""
print_status "Your application URLs:"
echo "  🌐 Frontend: http://$SERVER_IP"
echo "  🔧 Backend API: http://$SERVER_IP/api"
echo ""

print_status "Checking service status..."
sleep 5

ssh $SERVER_USER@$SERVER_IP << 'STATUS_EOF'
echo "===== PM2 Status ====="
pm2 status

echo ""
echo "===== Checking Services ====="
sleep 5
curl -s http://localhost:3001/api/health > /dev/null && echo "✅ Backend is running" || echo "⚠️  Backend may still be starting..."
curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend is running" || echo "⚠️  Frontend may still be building..."
STATUS_EOF

echo ""
print_status "Deployment complete! 🎉"

