# Oblio Invoice Integration Guide

## Overview

This guide explains how the Oblio API integration works for automatic invoice generation in your Geniki Taxydromiki + Shopify order management system.

**Oblio** is a Romanian invoicing and e-Factura platform that provides compliance with Romanian tax regulations. This integration allows you to automatically create invoices in Oblio for delivered orders.

---

## 🎯 Features

### ✅ What's Implemented

1. **Manual Invoice Creation** - Create invoices only when you're ready (after delivery)
2. **Individual Order Invoicing** - "Create Invoice" button on each delivered order
3. **Bulk Invoice Creation** - Create invoices for multiple delivered orders at once
4. **Invoice Status Display** - "✓ Invoiced" button with direct link to Oblio PDF
5. **Greek VAT (24%)** - Automatically applies correct VAT rate for Greek orders
6. **Private Customer Support** - No CIF/CUI required (for private persons)
7. **Invoice Cancellation** - Cancel invoices if needed
8. **Multi-line Item Support** - Includes all products + shipping costs
9. **Automatic Data Mapping** - Customer data from your CSV orders

---

## 📋 Requirements

### Oblio Account Setup

1. **Oblio Account**: Create account at [https://www.oblio.eu](https://www.oblio.eu)
2. **Company Registration**: Register your company (CLO SKIN S.R.L., CUI: 51655811)
3. **API Credentials**: 
   - Email: Your Oblio login email
   - Secret Token: Found in Oblio under "Setări" → "Date Cont"
4. **Invoice Series**: Configure invoice series in Oblio (default: "FCT")

### Database Setup

Run the migration to add Oblio fields:

```bash
psql -U postgres -d geniki_orders -f database-oblio-migration.sql
```

**Important**: After running the migration, update the `oblio_email` field with your actual Oblio login email:

```sql
UPDATE workspaces
SET oblio_email = 'your-actual-oblio-email@example.com'
WHERE workspace_id = 2;
```

---

## 🔧 Configuration

### Workspace Credentials

The Oblio credentials are stored per workspace in the `workspaces` table:

| Field | Description | Example |
|-------|-------------|---------|
| `oblio_email` | Your Oblio login email | `closkin@example.com` |
| `oblio_secret` | API secret token from Oblio | `9b4f9d839edec...` |
| `oblio_cif` | Your company's CUI with RO prefix | `RO51655811` |
| `oblio_series_name` | Invoice series name | `FCT` |
| `oblio_vat_rate` | VAT rate percentage | `24.00` (Greece) |

### OAuth 2.0 Authentication

The system automatically handles Oblio authentication:
- Access tokens are cached for 1 hour
- Tokens auto-refresh 5 minutes before expiry
- No manual token management needed

---

## 🚀 How to Use

### 1. Create Invoice for Single Order

**Steps:**
1. Navigate to the Orders tab
2. Find a **delivered** order (must show "✓ Delivered")
3. Click the **"Create Invoice"** button
4. Confirm the action
5. Invoice is created in Oblio
6. Button changes to **"✓ Invoiced"** (clickable to view PDF)

**What happens:**
- System sends order data to Oblio API
- Invoice is created with:
  - Customer name and address from order
  - All line items with prices
  - Shipping cost (if applicable)
  - 24% Greek VAT
  - Delivery date
  - Order reference (Shopify order name)
- Invoice PDF is generated in Oblio
- Database is updated with invoice details

### 2. Bulk Create Invoices

**Steps:**
1. Select multiple **delivered** orders (checkboxes)
2. Click **"Create Invoices (X)"** button in header
3. System filters to only delivered orders without invoices
4. Confirm the bulk action
5. Progress bar shows creation status
6. Results summary displayed

**Rate Limiting:**
- System waits 500ms between each invoice
- Respects Oblio API limits (30 requests per 100 seconds)
- Automatic error handling and retry logic

### 3. View Invoice

**Steps:**
1. Click the **"✓ Invoiced"** button on any invoiced order
2. Opens Oblio invoice page in new tab
3. View, download, or print PDF

### 4. Cancel Invoice (if needed)

**Note:** This functionality is available via API but not yet exposed in the UI.

**API Call:**
```bash
curl -X POST http://localhost:3000/api/orders/INB#1234GR/cancel-invoice \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: 2" \
  -d '{"workspaceId": 2}'
```

**What happens:**
- Invoice is marked as cancelled in Oblio
- Invoice details are cleared from database
- "Create Invoice" button reappears

---

## 📊 Invoice Data Mapping

### Customer Information

| Oblio Field | Source | Example |
|-------------|--------|---------|
| `name` | `shipping_name` or `billing_name` | "John Doe" |
| `address` | `shipping_address1` | "123 Main St" |
| `city` | `shipping_city` | "Athens" |
| `state` | `shipping_province` | "Attica" |
| `country` | `shipping_country_code` | "GR" |
| `email` | `email` | "john@example.com" |
| `phone` | `phone` | "+30 123456789" |
| `vatPayer` | Always `false` (private persons) | false |

### Product/Service Lines

Each order line item becomes an invoice product:

| Oblio Field | Source | Example |
|-------------|--------|---------|
| `name` | Product name | "Skin Cream 50ml" |
| `description` | Variant title | "Lavender Scent" |
| `quantity` | Quantity ordered | 2 |
| `price` | Unit price | 15.99 |
| `measuringUnit` | Always `buc` (pieces) | "buc" |
| `vatName` | Always "Normala" | "Normala" |
| `vatPercentage` | Workspace VAT rate | 24 |
| `vatIncluded` | Always `true` | true |

**Shipping:**
- Added as separate line item if `total_shipping > 0`
- Name: "Shipping / Transport"
- Price: Shipping cost from order

### Invoice Metadata

| Oblio Field | Source | Example |
|-------------|--------|---------|
| `issueDate` | Current date | "2025-11-25" |
| `dueDate` | Current date (immediate) | "2025-11-25" |
| `deliveryDate` | `delivered_at` or current date | "2025-11-24" |
| `remarks` | Order name + note | "Shopify Order: INB#1234GR" |
| `language` | Always `EL` (Greek) | "EL" |
| `currency` | Order currency | "EUR" |

---

## 🔌 API Endpoints

### Create Invoice for Single Order

**Endpoint:** `POST /api/orders/:orderName/create-invoice`

**Headers:**
```
Content-Type: application/json
X-Workspace-Id: 2
```

**Body:**
```json
{
  "workspaceId": 2
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "invoice": {
    "seriesName": "FCT",
    "number": "123",
    "url": "https://www.oblio.eu/factura/RO51655811/FCT/123"
  }
}
```

**Response (Error - Not Delivered):**
```json
{
  "success": false,
  "error": "Order must be delivered before creating invoice"
}
```

**Response (Error - Already Invoiced):**
```json
{
  "success": false,
  "error": "Invoice already exists for this order",
  "invoiceUrl": "https://www.oblio.eu/factura/..."
}
```

### Bulk Create Invoices

**Endpoint:** `POST /api/orders/bulk-create-invoices`

**Headers:**
```
Content-Type: application/json
X-Workspace-Id: 2
```

**Body:**
```json
{
  "orderNames": ["INB#1234GR", "INB#1235GR", "INB#1236GR"],
  "workspaceId": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invoices created: 3, skipped: 0, failed: 0",
  "summary": {
    "total": 3,
    "created": 3,
    "skipped": 0,
    "failed": 0
  },
  "results": [
    {
      "orderName": "INB#1234GR",
      "success": true,
      "invoice": {
        "seriesName": "FCT",
        "number": "123",
        "url": "https://www.oblio.eu/factura/..."
      }
    }
  ]
}
```

### Cancel Invoice

**Endpoint:** `POST /api/orders/:orderName/cancel-invoice`

**Headers:**
```
Content-Type: application/json
X-Workspace-Id: 2
```

**Body:**
```json
{
  "workspaceId": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invoice cancelled successfully"
}
```

---

## 🗄️ Database Schema

### Orders Table - New Columns

```sql
ALTER TABLE orders
  ADD COLUMN oblio_invoice_id TEXT,           -- Unique invoice ID (e.g., "FCT-123")
  ADD COLUMN oblio_series_name TEXT,          -- Invoice series (e.g., "FCT")
  ADD COLUMN oblio_invoice_number TEXT,       -- Invoice number (e.g., "123")
  ADD COLUMN oblio_invoice_url TEXT,          -- Direct URL to Oblio PDF
  ADD COLUMN invoiced_at TIMESTAMP;           -- When invoice was created
```

### Workspaces Table - New Columns

```sql
ALTER TABLE workspaces
  ADD COLUMN oblio_email TEXT,                -- Oblio login email
  ADD COLUMN oblio_secret TEXT,               -- Oblio API secret
  ADD COLUMN oblio_cif TEXT,                  -- Company CUI (e.g., "RO51655811")
  ADD COLUMN oblio_series_name TEXT DEFAULT 'FCT',  -- Default invoice series
  ADD COLUMN oblio_vat_rate DECIMAL(5,2) DEFAULT 24.00;  -- VAT percentage
```

---

## 🛠️ Technical Implementation

### Oblio API Functions

#### `getOblioAccessToken(workspaceId)`
- Authenticates with Oblio OAuth 2.0
- Caches access token for 1 hour
- Auto-refreshes 5 minutes before expiry
- Returns: Access token string

#### `makeOblioRequest(endpoint, method, data, workspaceId)`
- Makes authenticated requests to Oblio API
- Automatically adds Bearer token
- Error handling and logging
- Returns: API response data

#### `createOblioInvoice(orderData, workspaceId)`
- Prepares invoice data from order
- Maps customer information
- Adds all line items + shipping
- Calls Oblio `/docs/invoice` endpoint
- Returns: Invoice details (series, number, URL)

#### `cancelOblioInvoice(seriesName, number, workspaceId)`
- Cancels an existing invoice
- Calls Oblio `/docs/invoice/cancel` endpoint
- Returns: Success status

### Token Caching

```javascript
const oblioTokenCache = new Map();

// Cache structure:
{
  "oblio_2": {  // workspace_id = 2
    "access_token": "67d6f8817c28d698...",
    "expires_at": 1732550400000  // Unix timestamp
  }
}
```

### Rate Limiting

**Oblio API Limits:**
- Document generation: 30 requests per 100 seconds
- Other requests: 30 requests per 10 seconds

**Our Implementation:**
- 500ms delay between bulk invoice creations
- Automatic retry on rate limit errors
- Progress bar to show user status

---

## 🎨 UI Components

### Invoice Button States

1. **"Create Invoice"** (Blue button)
   - Shown when: Order is delivered AND not invoiced
   - Action: Creates invoice in Oblio
   - Icon: file-plus

2. **"✓ Invoiced"** (Green button)
   - Shown when: Order has invoice
   - Action: Opens invoice PDF in new tab
   - Icon: file-text
   - Style: `background: #d1fae5; color: #065f46;`

3. **Hidden**
   - Shown when: Order not delivered yet
   - No button displayed

### Bulk Action Button

**"Create Invoices (X)"** button in header:
- Enabled when: At least one order selected
- Badge shows: Number of selected orders
- Action: Bulk creates invoices for all selected delivered orders
- Auto-filters: Only processes delivered orders without invoices

---

## 🔍 Troubleshooting

### "Workspace does not have Oblio credentials configured"

**Problem:** Oblio email or secret not set in database

**Solution:**
```sql
UPDATE workspaces
SET 
  oblio_email = 'your-oblio-email@example.com',
  oblio_secret = 'your-oblio-secret-token',
  oblio_cif = 'RO51655811'
WHERE workspace_id = 2;
```

### "Oblio authentication failed"

**Problem:** Invalid credentials or expired secret

**Solution:**
1. Go to Oblio → Setări → Date Cont
2. Copy the new API secret
3. Update database:
```sql
UPDATE workspaces
SET oblio_secret = 'new-secret-token'
WHERE workspace_id = 2;
```

### "Order must be delivered before creating invoice"

**Problem:** Trying to invoice an order that's not delivered yet

**Solution:**
1. Wait for delivery confirmation from Geniki
2. Click "Track" button to update delivery status
3. Once "✓ Delivered" appears, invoice button will show

### "Invoice already exists for this order"

**Problem:** Invoice was already created

**Solution:**
- Click the "✓ Invoiced" button to view existing invoice
- If you need to recreate it, cancel the invoice first via API

### API Rate Limit Errors

**Problem:** Too many requests to Oblio

**Solution:**
- System automatically handles this with delays
- If bulk creating many invoices, wait a few minutes between batches
- Maximum: ~180 invoices per 10 minutes

### "No line items found"

**Problem:** Order has no products in `line_items` field

**Solution:**
- System automatically creates a single line with total price
- Ensure CSV import includes product data for better invoices

---

## 📈 Workflow Example

### Complete Order-to-Invoice Flow

1. **Import Order** (CSV)
   ```
   Order INB#1234GR imported
   → Customer: John Doe
   → Total: €50.00
   → Products: Skin Cream x2
   ```

2. **Fulfill Order** (Shopify)
   ```
   Click "Fulfill" → Creates fulfillment in Shopify
   → Tracking number: 5085051392
   → Shopify status: Fulfilled
   ```

3. **Create Voucher** (Geniki)
   ```
   System creates shipping voucher
   → Voucher number: 5085051392
   → Geniki status: sent
   ```

4. **Track Delivery** (Automatic/Manual)
   ```
   Click "Track" or wait for cron job
   → Geniki API: ΠΑΡΑΔΟΘΗΚΕ
   → Status: ✓ Delivered
   → Shopify updated: Delivered
   → COD payment collected (if applicable)
   ```

5. **Create Invoice** (Manual)
   ```
   Click "Create Invoice"
   → Oblio creates invoice FCT/123
   → Status: ✓ Invoiced
   → PDF available in Oblio
   ```

6. **View/Download**
   ```
   Click "✓ Invoiced" button
   → Opens Oblio invoice page
   → Download PDF for records
   ```

---

## 🧪 Testing

### Test Single Invoice Creation

1. Find a delivered order in your system
2. Click "Create Invoice"
3. Check Oblio dashboard for new invoice
4. Verify customer data is correct
5. Verify products and prices match
6. Check VAT calculation (should be 24%)

### Test Bulk Invoice Creation

1. Select 3-5 delivered orders
2. Click "Create Invoices (X)"
3. Watch progress bar
4. Verify all invoices created in Oblio
5. Check for any errors in summary

### Test with Test Order

Create a test order with:
- Customer: "Test Customer"
- Product: "Test Product" - €10.00
- Shipping: €5.00
- Total: €15.00

Expected invoice:
- Line 1: Test Product - €10.00 (€2.40 VAT)
- Line 2: Shipping - €5.00 (€1.20 VAT)
- Total: €15.00 (€3.60 VAT)

---

## 🔐 Security

### API Credentials

- **Never commit** `oblio_secret` to version control
- Store credentials in database only
- Use environment variables for sensitive data
- Rotate secrets periodically

### Access Control

- Workspace-based isolation
- Each workspace has separate Oblio credentials
- Cannot access invoices from other workspaces

### Token Management

- Access tokens cached in memory (not disk)
- Tokens expire after 1 hour
- Automatic refresh before expiry
- No manual token storage

---

## 📞 Support

### Oblio Support

- **Website:** [https://www.oblio.eu](https://www.oblio.eu)
- **Phone:** 0800 831 333
- **API Docs:** [https://www.oblio.eu/api](https://www.oblio.eu/api)
- **GitHub:** [https://github.com/OblioSoftware](https://github.com/OblioSoftware)

### Your System

- Check server logs: `tail -f server.log`
- Database queries: Use provided SQL snippets
- API testing: Use provided curl examples

---

## ✅ Benefits

### Automatic Invoicing
- ✅ No manual invoice creation in Oblio
- ✅ All customer data auto-filled
- ✅ Product details from order
- ✅ Correct VAT calculation

### Compliance
- ✅ Romanian e-Factura ready
- ✅ Legal invoice archiving
- ✅ Audit trail (invoiced_at timestamps)
- ✅ Proper invoice numbering

### Efficiency
- ✅ Bulk invoice creation
- ✅ Direct PDF access
- ✅ No double data entry
- ✅ Integrated workflow

### Tracking
- ✅ Invoice status visible in app
- ✅ Link to Oblio from app
- ✅ Invoice date tracking
- ✅ Series and number stored

---

## 🚀 Next Steps

Want to add more features?

### Possible Enhancements:
1. **Automatic Invoicing** - Create invoices automatically on delivery
2. **Cancel Invoice Button** - Add UI button for cancellation
3. **Invoice Preview** - Show invoice details before creation
4. **Email Invoices** - Auto-send invoice PDF to customer
5. **Multiple VAT Rates** - Support different VAT rates per product
6. **Proforma Invoices** - Create proforma before delivery
7. **Invoice Analytics** - Dashboard with invoice statistics
8. **Webhook Integration** - Receive notifications from Oblio

Let me know if you need any of these implemented!

---

## 📝 Quick Reference

### Key Files
- `server.js` - Oblio API integration (lines 1093-1292)
- `public/index.html` - Invoice buttons and UI (lines 2273-2290, 3384-3533)
- `database-oblio-migration.sql` - Database schema
- `OBLIO_INTEGRATION_GUIDE.md` - This document

### Important Functions
- `createOblioInvoice()` - Creates invoice
- `getOblioAccessToken()` - Authenticates
- `createInvoice()` - Frontend trigger
- `bulkCreateInvoices()` - Bulk processing

### API Limits
- 30 document generations per 100 seconds
- 30 other requests per 10 seconds
- 500ms delay between bulk operations

---

**🎉 Congratulations! Your Oblio invoice integration is ready to use!**






