# 🧪 Multi-Workspace Testing Checklist

## Before You Start

✅ Database migration already run
✅ InBreath workspace (ID: 2) already configured
✅ All backend functions updated

---

## 📋 Quick Test Suite

### Test 1: Basic Functionality (5 minutes)

Open your app and verify existing features still work:

- [ ] **Load orders** - Orders should display normally
- [ ] **Import CSV** - Should import into correct workspace
- [ ] **Track status** - Click "Track" button on any order
- [ ] **View voucher PDF** - Download should work
- [ ] **Create invoice** - For a delivered order

**Expected:** Everything works exactly as before

---

### Test 2: Workspace-Specific Features (10 minutes)

#### A. Geniki Integration (Using InBreath credentials)

1. **Create a test voucher:**
   ```bash
   curl -X POST http://localhost:3000/api/orders/TEST-001/create-voucher \
     -H "Content-Type: application/json" \
     -H "X-Workspace-Id: 2" \
     -d '{
       "order_name": "TEST-001",
       "customer_name": "Test Customer",
       "shipping_address1": "Test Street 123",
       "shipping_city": "Athens",
       "shipping_zip": "10434",
       "shipping_country_code": "GR",
       "shipping_phone": "2101234567",
       "email": "test@example.gr",
       "total_price": "25.00",
       "line_items": "1x Test Product"
     }'
   ```

- [ ] Should create voucher successfully
- [ ] Should use InBreath's Geniki credentials
- [ ] Check terminal logs - should show workspace 2

#### B. Invoice Creation (Using InBreath settings)

1. **Create invoice for a delivered order:**
   - Find delivered order (e.g., INB#1004GR)
   - Click "Create Invoice"
   - Check the invoice in Oblio

- [ ] Invoice should be in **English** (EN)
- [ ] Currency should be **EUR**
- [ ] VAT should be **21%**
- [ ] Series should be **CLOGRA**
- [ ] Shipping should be €3 if total < €40, €0 if total ≥ €40

#### C. Shopify Integration

1. **Test fulfillment:**
   - Select an unfulfilled order
   - Click "Fulfill"
   - Check Shopify

- [ ] Should create fulfillment in correct Shopify store
- [ ] Should use workspace 2's Shopify credentials

2. **Test delivery sync:**
   - Find a delivered order
   - Click "Sync" button
   - Check Shopify delivery status

- [ ] Should update delivery status to "Delivered"
- [ ] COD orders should capture payment

---

### Test 3: Workspace Isolation (15 minutes)

When you add a second workspace, verify:

#### A. Data Isolation
- [ ] Orders from workspace 1 don't appear in workspace 2
- [ ] Vouchers are workspace-specific
- [ ] Invoices use correct workspace settings

#### B. Credential Isolation
- [ ] Workspace 1 uses its own Geniki credentials
- [ ] Workspace 2 uses its own Geniki credentials
- [ ] Shopify API calls go to correct store
- [ ] Oblio invoices use correct series per workspace

#### C. Settings Isolation
- [ ] Different VAT rates per workspace
- [ ] Different shipping thresholds per workspace
- [ ] Different invoice languages per workspace
- [ ] Different invoice currencies per workspace

---

## 🔍 Debug Checklist

If something doesn't work:

### Check Terminal Logs

Look for workspace ID in logs:
```
📦 Fulfilling order TEST-001 in workspace 2
🔍 Using Geniki credentials for workspace: 2
🧾 Creating Oblio invoice for workspace: 2
```

### Check Database

```sql
-- Verify workspace settings
SELECT 
  workspace_id,
  workspace_name,
  geniki_username,
  oblio_series_name,
  oblio_vat_rate,
  invoice_language,
  invoice_currency,
  shipping_threshold,
  shipping_cost
FROM workspaces 
WHERE workspace_id = 2;

-- Verify orders are assigned to workspace
SELECT 
  order_name,
  workspace_id,
  voucher_number,
  fulfillment_status
FROM orders 
WHERE workspace_id = 2
LIMIT 10;
```

### Common Issues

**Issue:** "Workspace X does not have Shopify credentials configured"
- **Fix:** Check `shopify_shop` and `shopify_access_token` in workspace settings

**Issue:** Geniki authentication fails
- **Fix:** Verify `geniki_username`, `geniki_password`, `geniki_app_key` in workspace settings

**Issue:** Invoice created with wrong VAT/language
- **Fix:** Check `invoice_language`, `oblio_vat_rate` in workspace settings

**Issue:** Wrong shipping cost applied
- **Fix:** Verify `shipping_threshold` and `shipping_cost` in workspace settings

---

## 📊 Test Results Template

Copy this and fill it out:

```
# Test Results - [Date]

## Environment
- Workspace: InBreath (ID: 2)
- Database: ✅ Migration complete
- Server: ✅ Running on port 3000

## Basic Functionality
- [ ] Load orders: ✅ / ❌
- [ ] Import CSV: ✅ / ❌
- [ ] Track status: ✅ / ❌
- [ ] Download PDF: ✅ / ❌
- [ ] Create invoice: ✅ / ❌

## Geniki Integration
- [ ] Create voucher: ✅ / ❌
- [ ] Uses correct credentials: ✅ / ❌
- [ ] Workspace ID in logs: ✅ / ❌

## Invoice Creation
- [ ] Language correct (EN): ✅ / ❌
- [ ] Currency correct (EUR): ✅ / ❌
- [ ] VAT correct (21%): ✅ / ❌
- [ ] Series correct (CLOGRA): ✅ / ❌
- [ ] Shipping rules applied: ✅ / ❌

## Shopify Integration
- [ ] Fulfillment works: ✅ / ❌
- [ ] Delivery sync works: ✅ / ❌
- [ ] Payment capture works (COD): ✅ / ❌

## Notes
[Any issues or observations]
```

---

## 🎯 Success Criteria

Your app is working correctly if:

✅ All existing features work as before
✅ Workspace ID appears in terminal logs
✅ Invoices use workspace-specific settings (language, VAT, currency, series)
✅ Shipping rules apply correctly per workspace
✅ Geniki API uses workspace credentials
✅ Shopify API uses workspace credentials
✅ No errors in terminal logs

---

## 🚀 Ready to Test?

1. **Start your server** (if not already running):
   ```bash
   cd "/Users/horiaq/Desktop/Dev Projects/Geniki Taxydromiki"
   node server.js
   ```

2. **Open your app**: http://localhost:3000

3. **Run through the tests above**

4. **Report any issues** - I'm here to help!

---

## 💡 Quick Verification Commands

```bash
# Check if server is running
curl http://localhost:3000/api/health

# Get workspace settings
curl http://localhost:3000/api/workspaces \
  -H "X-Workspace-Id: 2"

# Test Geniki authentication (check terminal logs)
curl -X POST http://localhost:3000/api/test-geniki-api \
  -H "X-Workspace-Id: 2"
```

---

**Happy Testing!** 🎉

If anything doesn't work as expected, just let me know and I'll help you debug it! 💪

