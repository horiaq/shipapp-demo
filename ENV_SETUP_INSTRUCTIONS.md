# 🔐 Environment Setup for Authentication

## Add to your `.env` file:

Open your `.env` file and add these two lines:

```env
# Authentication
JWT_SECRET=e8bc36c66a4c99ed3e785b2461d8945c032e38218b687152702566bbb63cc93e
JWT_EXPIRES_IN=7d
```

**Note:** I've generated a secure random JWT secret for you above. This secret is used to sign and verify JWT tokens.

## Your full `.env` should include:

```env
# Database
DB_USER=horiaq
DB_HOST=localhost
DB_NAME=geniki_orders
DB_PASSWORD=your-db-password
DB_PORT=5432

# Authentication (NEW)
JWT_SECRET=e8bc36c66a4c99ed3e785b2461d8945c032e38218b687152702566bbb63cc93e
JWT_EXPIRES_IN=7d

# Geniki Taxydromiki
GENIKI_USERNAME=closkin
GENIKI_PASSWORD=csk$$149
GENIKI_APPKEY=B7772667-0B6D-4FDA-8408-111D6D7F2989
GENIKI_WSDL=https://voucher.taxydromiki.gr/JobServicesV2.asmx?WSDL

# Shopify (if you have it)
SHOPIFY_SHOP=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-token

# Server
PORT=3000
NODE_ENV=development
```

## ✅ After adding these, Phase 2 is complete!

