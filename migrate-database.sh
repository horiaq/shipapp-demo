#!/bin/bash

# Database Migration Script - Local to Hetzner Production
# This script backs up your local database and restores it to production

set -e

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

# Configuration
SERVER_IP="91.98.94.41"
SERVER_USER="root"
BACKUP_FILE="shipapp_backup_$(date +%Y%m%d_%H%M%S).sql"

print_status "======================================"
print_status "Database Migration: Local → Production"
print_status "======================================"
echo ""

# Step 1: Detect local database name
print_status "Step 1: Detecting local database..."

# Try to find the local database name from .env
if [ -f ".env" ]; then
    LOCAL_DB=$(grep DATABASE_URL .env | cut -d'/' -f4)
    if [ -z "$LOCAL_DB" ]; then
        print_warning "Could not detect database from .env"
        read -p "Enter your LOCAL database name (default: shippy_wms): " LOCAL_DB
        LOCAL_DB=${LOCAL_DB:-shippy_wms}
    fi
else
    read -p "Enter your LOCAL database name (default: shippy_wms): " LOCAL_DB
    LOCAL_DB=${LOCAL_DB:-shippy_wms}
fi

print_status "Local database: $LOCAL_DB"
echo ""

# Step 2: Create backup of local database
print_status "Step 2: Creating backup of local database..."

# Check if database exists
if ! psql -lqt | cut -d \| -f 1 | grep -qw "$LOCAL_DB"; then
    print_error "Database '$LOCAL_DB' not found on local machine!"
    print_warning "Available databases:"
    psql -l
    exit 1
fi

print_status "Backing up $LOCAL_DB to $BACKUP_FILE..."

# Create backup (plain SQL format for easy restoration)
pg_dump "$LOCAL_DB" > "$BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup failed!"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
print_status "Backup created successfully! Size: $BACKUP_SIZE"
echo ""

# Step 3: Transfer backup to production server
print_status "Step 3: Transferring backup to production server..."

scp "$BACKUP_FILE" "$SERVER_USER@$SERVER_IP:/tmp/"

if [ $? -eq 0 ]; then
    print_status "Backup transferred successfully!"
else
    print_error "Failed to transfer backup!"
    exit 1
fi
echo ""

# Step 4: Restore database on production
print_status "Step 4: Restoring database on production server..."

ssh "$SERVER_USER@$SERVER_IP" bash -s << REMOTE_SCRIPT
set -e

echo "Stopping services..."
pm2 stop all || true

echo "Dropping existing database..."
sudo -u postgres psql << 'PSQL_EOF'
DROP DATABASE IF EXISTS shipapp_db;
CREATE DATABASE shipapp_db;
ALTER DATABASE shipapp_db OWNER TO shipapp_admin;
PSQL_EOF

echo "Restoring database from backup..."
sudo -u postgres psql shipapp_db < /tmp/$BACKUP_FILE

echo "Cleaning up backup file..."
rm -f /tmp/$BACKUP_FILE

echo "Restarting services..."
pm2 restart all

echo "✅ Database restored successfully!"
REMOTE_SCRIPT

if [ $? -eq 0 ]; then
    print_status "✅ Database restored successfully on production!"
else
    print_error "Failed to restore database!"
    exit 1
fi
echo ""

# Step 5: Verify migration
print_status "Step 5: Verifying migration..."

ssh "$SERVER_USER@$SERVER_IP" << 'VERIFY_SCRIPT'
echo "Checking user account..."
sudo -u postgres psql shipapp_db -c "SELECT email, name FROM users WHERE email = 'horia@wiresells.com';" || echo "User table may not exist yet"

echo ""
echo "Checking database tables..."
sudo -u postgres psql shipapp_db -c "\dt" | head -20

echo ""
echo "Checking row counts..."
sudo -u postgres psql shipapp_db << 'SQL_EOF'
SELECT 
    (SELECT COUNT(*) FROM users) as user_count,
    (SELECT COUNT(*) FROM orders) as order_count,
    (SELECT COUNT(*) FROM workspaces) as workspace_count;
SQL_EOF
VERIFY_SCRIPT

echo ""
print_status "======================================"
print_status "Migration Complete! 🎉"
print_status "======================================"
echo ""
print_status "Your account (horia@wiresells.com) and all data have been migrated!"
echo ""
print_warning "Next steps:"
echo "  1. Visit: http://$SERVER_IP"
echo "  2. Login with: horia@wiresells.com"
echo "  3. Verify all your data is there"
echo ""
print_warning "Local backup saved as: $BACKUP_FILE"
echo "  (Keep this file safe as a backup!)"
echo ""
print_status "Service status:"
ssh "$SERVER_USER@$SERVER_IP" "pm2 status"

