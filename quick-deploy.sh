#!/bin/bash

# Quick Deployment Script for Hetzner
# Run this on your LOCAL machine

echo "🚀 Shippy WMS - Quick Deployment to Hetzner"
echo "=============================================="
echo ""

# Server details
SERVER_IP="91.98.94.41"
SERVER_USER="root"

echo "Server: $SERVER_USER@$SERVER_IP"
echo ""

# Test connection
echo "Testing SSH connection..."
if ssh -o ConnectTimeout=5 $SERVER_USER@$SERVER_IP "echo 'Connection OK'" > /dev/null 2>&1; then
    echo "✅ SSH connection successful!"
else
    echo "❌ Cannot connect to server. Please check:"
    echo "   - Server is running"
    echo "   - SSH key is added (run: ssh-add ~/.ssh/your_key)"
    echo "   - Firewall allows SSH"
    exit 1
fi

echo ""
echo "Choose deployment method:"
echo "1) Automated deployment (recommended)"
echo "2) Manual step-by-step instructions"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "Starting automated deployment..."
        ./deploy-to-hetzner.sh
        ;;
    2)
        echo ""
        echo "Please follow the instructions in HETZNER_DEPLOYMENT_GUIDE.md"
        echo "Or visit: https://github.com/horiaq/shipapp-demo/blob/main/HETZNER_DEPLOYMENT_GUIDE.md"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac


