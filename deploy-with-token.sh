#!/bin/bash

# Hetzner Deployment Script with GitHub Personal Access Token
# This script deploys a private repository using a GitHub PAT

set -e

# Configuration
SERVER_IP="91.98.94.41"
SERVER_USER="root"
APP_DIR="/var/www/shippy-wms"
GITHUB_USER="horiaq"
REPO_NAME="shipapp-demo"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[*]${NC} $1"
}

print_error() {
    echo -e "${RED}[!]${NC} $1"
}

# Check if token is provided as argument
if [ -z "$1" ]; then
    echo ""
    print_warning "GitHub Personal Access Token required!"
    echo ""
    echo "To create a token:"
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Click 'Generate new token' -> 'Generate new token (classic)'"
    echo "3. Give it a name (e.g., 'Hetzner Deployment')"
    echo "4. Select scopes: 'repo' (Full control of private repositories)"
    echo "5. Click 'Generate token'"
    echo "6. Copy the token (you won't see it again!)"
    echo ""
    read -p "Enter your GitHub Personal Access Token: " -s GITHUB_TOKEN
    echo ""
else
    GITHUB_TOKEN="$1"
fi

if [ -z "$GITHUB_TOKEN" ]; then
    print_error "No token provided. Exiting."
    exit 1
fi

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
else
    echo "Node.js 20+ already installed"
fi

echo "===== Installing PostgreSQL ====="
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
else
    echo "PostgreSQL already installed"
fi

echo "===== Installing Nginx ====="
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
else
    echo "Nginx already installed"
fi

echo "===== Installing additional tools ====="
apt-get install -y git curl build-essential

echo "===== Installing PM2 ====="
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "PM2 already installed"
fi

echo "===== Setting up PostgreSQL database ====="
sudo -u postgres psql << 'PSQL_EOF'
-- Drop and recreate database
DROP DATABASE IF EXISTS shippy_wms;
DROP USER IF EXISTS shippy_admin;

CREATE DATABASE shippy_wms;
CREATE USER shippy_admin WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE shippy_wms TO shippy_admin;
ALTER DATABASE shippy_wms OWNER TO shippy_admin;
PSQL_EOF

echo "===== Cloning repository with token ====="
# Remove old directory if exists
rm -rf $APP_DIR

# Clone using token
git clone https://$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git $APP_DIR

cd $APP_DIR

# Remove the token from git config for security
git remote set-url origin https://github.com/$GITHUB_USER/$REPO_NAME.git

echo "===== Setting up backend environment ====="
cat > $APP_DIR/.env << 'ENV_EOF'
PORT=3001
DATABASE_URL=postgresql://shippy_admin:$DB_PASSWORD@localhost:5432/shippy_wms
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
FRONTEND_URL=http://$SERVER_IP
EOF

echo "===== Installing backend dependencies ====="
cd $APP_DIR
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
        sudo -u postgres psql -d shippy_wms -f "\$sql_file" 2>&1 || echo "Warning: \$sql_file may have errors"
    fi
done

echo "===== Setting up PM2 ====="
cd $APP_DIR

# Stop existing processes
pm2 delete shippy-backend 2>/dev/null || true
pm2 delete shippy-frontend 2>/dev/null || true

# Start backend
pm2 start server.js --name shippy-backend --time

# Start frontend
cd frontend
pm2 start npm --name shippy-frontend -- start

# Save configuration
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "===== Configuring Nginx ====="
cat > /etc/nginx/sites-available/shippy-wms << 'NGINX_EOF'
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
ln -sf /etc/nginx/sites-available/shippy-wms /etc/nginx/sites-enabled/

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
Shippy WMS Deployment Credentials
Generated: $(date)
Server: $SERVER_IP

Database Password: $DB_PASSWORD
JWT Secret: $JWT_SECRET
Session Secret: $SESSION_SECRET

Database Connection String:
postgresql://shippy_admin:$DB_PASSWORD@localhost:5432/shippy_wms

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
sleep 3

ssh $SERVER_USER@$SERVER_IP << 'STATUS_EOF'
echo "===== PM2 Status ====="
pm2 status

echo ""
echo "===== Checking Services ====="
sleep 3
curl -s http://localhost:3001/api/health > /dev/null && echo "✅ Backend is running" || echo "⚠️  Backend may still be starting..."
curl -s http://localhost:3000 > /dev/null && echo "✅ Frontend is running" || echo "⚠️  Frontend may still be building..."
STATUS_EOF

echo ""
print_warning "Next steps:"
echo "  1. Visit http://$SERVER_IP"
echo "  2. Create your first admin user"
echo "  3. Configure API keys in settings"
echo ""
print_warning "Useful commands:"
echo "  - View logs: ssh root@$SERVER_IP 'pm2 logs'"
echo "  - Restart: ssh root@$SERVER_IP 'pm2 restart all'"
echo "  - Status: ssh root@$SERVER_IP 'pm2 status'"
echo ""
print_status "Deployment complete! 🎉"

