# Hetzner Deployment Guide for Shippy WMS

## Server Information
- **Server ID**: #114196820
- **Name**: ubuntu-4gb-fsn1-1
- **IP Address**: 91.98.94.41
- **IPv6**: 2a01:4f8:c014:1e7e::/64
- **SSH Key**: etrack-hetzner

## Prerequisites
- Ubuntu server (4GB RAM minimum)
- SSH access to the server
- Domain name (optional, but recommended)

## Deployment Steps

### Step 1: Initial Server Setup

First, SSH into your server:

```bash
ssh root@91.98.94.41
```

### Step 2: Run the Automated Deployment Script

On your LOCAL machine, run:

```bash
bash deploy-to-hetzner.sh
```

This script will:
1. Update system packages
2. Install Node.js 20.x
3. Install PostgreSQL 14
4. Install Nginx
5. Set up the database
6. Clone and configure the application
7. Set up PM2 for process management
8. Configure Nginx as a reverse proxy
9. Set up SSL (if domain is configured)

### Step 3: Manual Setup (if you prefer)

If you want to set up manually, follow these steps:

#### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### 2. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### 3. Install PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
```

#### 4. Install Nginx
```bash
sudo apt install -y nginx
```

#### 5. Set Up Database
```bash
sudo -u postgres psql
```

Then in PostgreSQL:
```sql
CREATE DATABASE shippy_wms;
CREATE USER shippy_admin WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE shippy_wms TO shippy_admin;
\q
```

#### 6. Clone Repository
```bash
cd /var/www
sudo git clone https://github.com/horiaq/shipapp-demo.git shippy-wms
cd shippy-wms
```

#### 7. Set Up Backend
```bash
npm install
```

Create `.env` file:
```bash
sudo nano .env
```

Add:
```env
PORT=3001
DATABASE_URL=postgresql://shippy_admin:your_secure_password_here@localhost:5432/shippy_wms
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
SESSION_SECRET=your_super_secret_session_key_change_this_in_production
NODE_ENV=production
FRONTEND_URL=http://91.98.94.41:3000
```

#### 8. Set Up Frontend
```bash
cd frontend
npm install
```

Create `.env.local`:
```bash
sudo nano .env.local
```

Add:
```env
NEXT_PUBLIC_API_URL=http://91.98.94.41:3001
```

Build frontend:
```bash
npm run build
```

#### 9. Run Database Migrations
```bash
cd /var/www/shippy-wms
sudo -u postgres psql -d shippy_wms -f database-setup.sql
sudo -u postgres psql -d shippy_wms -f database-auth-system.sql
sudo -u postgres psql -d shippy_wms -f database-workspaces-migration.sql
sudo -u postgres psql -d shippy_wms -f database-multi-workspace-migration.sql
sudo -u postgres psql -d shippy_wms -f database-oblio-migration.sql
sudo -u postgres psql -d shippy_wms -f database-order-status-migration.sql
sudo -u postgres psql -d shippy_wms -f database-shopify-delivery-migration.sql
sudo -u postgres psql -d shippy_wms -f database-tracking-migration.sql
sudo -u postgres psql -d shippy_wms -f database-workspace-settings-migration.sql
```

#### 10. Install PM2 and Start Services
```bash
sudo npm install -g pm2

# Start backend
pm2 start server.js --name shippy-backend

# Start frontend
cd frontend
pm2 start npm --name shippy-frontend -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

#### 11. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/shippy-wms
```

Add:
```nginx
# Backend API
server {
    listen 80;
    server_name 91.98.94.41;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/shippy-wms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 4: Configure Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Step 5: Set Up SSL (Optional but Recommended)

If you have a domain name:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Environment Variables

### Backend (.env)
```env
PORT=3001
DATABASE_URL=postgresql://shippy_admin:PASSWORD@localhost:5432/shippy_wms
JWT_SECRET=generate_a_secure_random_string
SESSION_SECRET=generate_another_secure_random_string
NODE_ENV=production
FRONTEND_URL=http://91.98.94.41:3000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://91.98.94.41:3001
```

## Useful Commands

### Check Application Status
```bash
pm2 status
pm2 logs
```

### Restart Services
```bash
pm2 restart shippy-backend
pm2 restart shippy-frontend
```

### Update Application
```bash
cd /var/www/shippy-wms
git pull origin main
npm install
cd frontend
npm install
npm run build
pm2 restart all
```

### Database Backup
```bash
sudo -u postgres pg_dump shippy_wms > backup_$(date +%Y%m%d).sql
```

### View Logs
```bash
# Backend logs
pm2 logs shippy-backend

# Frontend logs
pm2 logs shippy-frontend

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## Troubleshooting

### Service Won't Start
```bash
pm2 delete all
pm2 start server.js --name shippy-backend
cd frontend && pm2 start npm --name shippy-frontend -- start
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connection
psql -U shippy_admin -d shippy_wms -h localhost
```

### Nginx Issues
```bash
# Check Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx
```

## Security Recommendations

1. **Change default passwords** in `.env` file
2. **Set up SSL/TLS** with Let's Encrypt
3. **Configure firewall** properly
4. **Regular backups** of database and files
5. **Keep system updated**: `sudo apt update && sudo apt upgrade`
6. **Monitor logs** regularly
7. **Set up fail2ban** for SSH protection

## Accessing the Application

After deployment, access your application at:
- **Frontend**: http://91.98.94.41
- **Backend API**: http://91.98.94.41/api

## Next Steps

1. Configure your domain name (if you have one)
2. Set up SSL certificate
3. Configure backup automation
4. Set up monitoring (e.g., PM2 Plus, New Relic)
5. Configure email settings for notifications
6. Add your API keys (Geniki, Shopify, etc.)


