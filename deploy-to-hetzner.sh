#!/bin/bash

# Shippy WMS - Hetzner Deployment Script
# This script automates the deployment of Shippy WMS to a Hetzner server

set -e  # Exit on any error

# Configuration
SERVER_IP="91.98.94.41"
SERVER_USER="root"
APP_DIR="/var/www/shippy-wms"
REPO_URL="https://github.com/horiaq/shipapp-demo.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_error() {
    echo -e "${RED}[!]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[*]${NC} $1"
}

# Check if we can connect to the server
print_status "Checking connection to server..."
if ! ssh -o ConnectTimeout=5 $SERVER_USER@$SERVER_IP "echo 'Connection successful'" > /dev/null 2>&1; then
    print_error "Cannot connect to server. Please check:"
    echo "  1. Server IP: $SERVER_IP"
    echo "  2. SSH key is added: ssh-add -l"
    echo "  3. Server is running"
    exit 1
fi

print_status "Connected to server successfully!"

# Prompt for database password
print_warning "Please enter a secure password for the database:"
read -s DB_PASSWORD
echo

print_warning "Please enter a secure JWT secret (or press Enter to generate):"
read JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
fi

print_warning "Please enter a secure session secret (or press Enter to generate):"
read SESSION_SECRET
if [ -z "$SESSION_SECRET" ]; then
    SESSION_SECRET=$(openssl rand -base64 32)
fi

print_status "Starting deployment..."

# Deploy to server
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
set -e

echo "===== Updating system packages ====="
apt update && apt upgrade -y

echo "===== Installing Node.js 20.x ====="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "===== Installing PostgreSQL ====="
apt install -y postgresql postgresql-contrib

echo "===== Installing Nginx ====="
apt install -y nginx

echo "===== Installing additional tools ====="
apt install -y git curl build-essential

echo "===== Installing PM2 ====="
npm install -g pm2

ENDSSH

print_status "Basic setup complete. Setting up database..."

# Set up database
ssh $SERVER_USER@$SERVER_IP << ENDSSH
set -e

echo "===== Setting up PostgreSQL database ====="
sudo -u postgres psql << EOF
CREATE DATABASE shippy_wms;
CREATE USER shippy_admin WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE shippy_wms TO shippy_admin;
ALTER DATABASE shippy_wms OWNER TO shippy_admin;
\q
EOF

ENDSSH

print_status "Database created successfully!"

# Clone repository and set up application
ssh $SERVER_USER@$SERVER_IP << ENDSSH
set -e

echo "===== Cloning repository ====="
if [ -d "$APP_DIR" ]; then
    echo "Directory exists, pulling latest changes..."
    cd $APP_DIR
    git pull origin main
else
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

echo "===== Setting up backend environment ====="
cat > .env << EOF
PORT=3001
DATABASE_URL=postgresql://shippy_admin:$DB_PASSWORD@localhost:5432/shippy_wms
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
FRONTEND_URL=http://$SERVER_IP:3000
EOF

echo "===== Installing backend dependencies ====="
npm install --production

echo "===== Setting up frontend environment ====="
cd frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://$SERVER_IP:3001
EOF

echo "===== Installing frontend dependencies ====="
npm install

echo "===== Building frontend ====="
npm run build

ENDSSH

print_status "Application installed successfully!"

# Run database migrations
print_status "Running database migrations..."
ssh $SERVER_USER@$SERVER_IP << ENDSSH
set -e

cd $APP_DIR

echo "===== Running database migrations ====="
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
        sudo -u postgres psql -d shippy_wms -f "\$sql_file" || echo "Warning: \$sql_file may have failed"
    fi
done

ENDSSH

print_status "Database migrations complete!"

# Start services with PM2
print_status "Starting services with PM2..."
ssh $SERVER_USER@$SERVER_IP << ENDSSH
set -e

cd $APP_DIR

echo "===== Stopping existing PM2 processes ====="
pm2 delete shippy-backend 2>/dev/null || true
pm2 delete shippy-frontend 2>/dev/null || true

echo "===== Starting backend ====="
pm2 start server.js --name shippy-backend

echo "===== Starting frontend ====="
cd frontend
pm2 start npm --name shippy-frontend -- start

echo "===== Saving PM2 configuration ====="
pm2 save

echo "===== Setting up PM2 startup ====="
pm2 startup systemd -u root --hp /root || true

ENDSSH

print_status "Services started successfully!"

# Configure Nginx
print_status "Configuring Nginx..."
ssh $SERVER_USER@$SERVER_IP << ENDSSH
set -e

echo "===== Creating Nginx configuration ====="
cat > /etc/nginx/sites-available/shippy-wms << 'EOF'
server {
    listen 80;
    server_name $SERVER_IP;

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
EOF

echo "===== Enabling site ====="
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/shippy-wms /etc/nginx/sites-enabled/

echo "===== Testing Nginx configuration ====="
nginx -t

echo "===== Restarting Nginx ====="
systemctl restart nginx
systemctl enable nginx

ENDSSH

print_status "Nginx configured successfully!"

# Configure firewall
print_status "Configuring firewall..."
ssh $SERVER_USER@$SERVER_IP << ENDSSH
set -e

echo "===== Setting up UFW firewall ====="
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw status

ENDSSH

print_status "Firewall configured successfully!"

# Final status check
print_status "Checking service status..."
ssh $SERVER_USER@$SERVER_IP << ENDSSH
echo "===== PM2 Status ====="
pm2 status

echo "===== Nginx Status ====="
systemctl status nginx --no-pager

echo "===== PostgreSQL Status ====="
systemctl status postgresql --no-pager

ENDSSH

print_status "======================================"
print_status "Deployment completed successfully!"
print_status "======================================"
echo ""
print_status "Your application is now running at:"
echo "  Frontend: http://$SERVER_IP"
echo "  Backend API: http://$SERVER_IP/api"
echo ""
print_warning "Next steps:"
echo "  1. Configure your domain name (optional)"
echo "  2. Set up SSL certificate with: sudo certbot --nginx -d yourdomain.com"
echo "  3. Add your API keys in the settings page"
echo "  4. Create your first user account"
echo ""
print_warning "Useful commands:"
echo "  - Check logs: ssh $SERVER_USER@$SERVER_IP 'pm2 logs'"
echo "  - Restart services: ssh $SERVER_USER@$SERVER_IP 'pm2 restart all'"
echo "  - Update app: ssh $SERVER_USER@$SERVER_IP 'cd $APP_DIR && git pull && pm2 restart all'"
echo ""






