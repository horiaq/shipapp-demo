# eTrack - Order Management System

Complete shipping label automation and invoicing for your e-commerce business.

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Shopify Custom App

1. Go to Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps" → "Create an app"
3. Name it "Geniki Shipping"
4. Configure Admin API scopes:
   - `read_orders`
   - `write_orders`
   - `read_fulfillments`
   - `write_fulfillments`
5. Install the app
6. Copy the "Admin API access token"

### 3. Configure Environment Variables

Create `.env` file:
```env
# Test credentials (provided)
GENIKI_USERNAME=clotest
GENIKI_PASSWORD=700149@
GENIKI_APPKEY=D8E50F4B-E372-4CFC-8330-EEF2B8D6D478

# Your Shopify store
SHOPIFY_SHOP=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxx

# Generate webhook secret (any random string)
SHOPIFY_WEBHOOK_SECRET=your_random_secret_here

NODE_ENV=development
PORT=3000
```

### 4. Test Connection
```bash
npm run test
```

You should see:
```
✓ Connected to WSDL
✓ Authentication successful
✓ Auth Key: xxxxxxxxx
✅ Connection test passed!
```

### 5. Start Server
```bash
npm start
```

### 6. Setup Webhook (for auto-creation)

In your Shopify app settings:
1. Go to "Event subscriptions"
2. Add webhook:
   - Event: `orders/create`
   - URL: `https://your-domain.com/webhooks/orders/create`
   - Format: JSON

### 7. Access the App

Open: `http://localhost:3000`

## 📋 Usage

### Manual Label Creation
1. Go to app dashboard
2. Select pending orders
3. Click "Create Vouchers"
4. Print labels
5. Click "Finalize All" before shipping

### Automatic (via Webhook)
- Vouchers are created automatically when orders are placed
- Tracking is added to Shopify automatically

## 🔧 API Endpoints

### Orders
- `GET /api/orders` - List unfulfilled orders
- `POST /api/orders/:id/voucher` - Create voucher for order
- `POST /api/orders/bulk-voucher` - Create multiple vouchers

### Vouchers
- `GET /api/voucher/:number/pdf` - Download label
- `POST /api/vouchers/finalize` - Finalize all pending
- `GET /api/voucher/:number/track` - Track shipment
- `POST /api/job/:id/cancel` - Cancel voucher

## 📦 Daily Workflow

1. Morning: Check pending orders
2. Create vouchers (bulk or auto)
3. Print labels
4. **Before pickup: Click "Finalize All"** ← CRITICAL!
5. Hand packages to Geniki courier

## 🔐 Production Credentials

After testing all required methods:
1. ✅ Authenticate
2. ✅ CreateJob
3. ✅ GetVouchersPdf
4. ✅ CancelJob
5. ✅ ClosePendingJobs

Contact Geniki sales for production credentials.

## 🐛 Troubleshooting

**"Authentication failed"**
- Check credentials in .env
- Ensure test mode is enabled

**"Voucher creation failed code 700"**
- Missing required fields (Name, Address, City)

**"Code 11: Invalid key"**
- Auth key expired, will auto-refresh

**Webhook not working**
- Check webhook secret matches .env
- Verify webhook URL is publicly accessible
- Check server logs

## 📚 Error Codes

- 0: Success
- 1: Authentication failed
- 700-712: Validation errors
- 11: Invalid/expired key
- 14: Server busy

Full list in Geniki API documentation.

## 🚀 Deploy to Production

### Option 1: VPS (DigitalOcean, Linode, etc)
```bash
# Install Node.js
# Clone repo
# Set production .env
NODE_ENV=production npm start
```

### Option 2: Heroku
```bash
heroku create your-app-name
git push heroku main
heroku config:set SHOPIFY_SHOP=...
```

### Option 3: Railway/Render
- Connect GitHub repo
- Add environment variables
- Deploy

## 📝 Notes

- Test mode uses test credentials
- Production requires approval from Geniki
- Auth keys cached for 23 hours
- Always finalize before shipping!

## 🆘 Support

Issues? Check:
1. Server logs
2. Geniki API documentation
3. Shopify API status
```