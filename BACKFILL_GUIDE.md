# Backfill Guide: Update Historical Orders

**Purpose:** Update orders that were delivered BEFORE the automatic Shopify delivery/payment feature was implemented.

---

## 🎯 What This Does

For orders delivered before November 25, 2025:
1. **Fetches Shopify fulfillment IDs** from already-fulfilled orders
2. **Stores them** in your database
3. **Re-syncs delivery status** to Shopify
4. **Marks COD payments** as collected

---

## 🖱️ Easy Method: Use the UI Buttons (NEW!)

### Individual Order Sync

For any fulfilled or delivered order, you'll now see a **"Sync"** button with a refresh icon:

1. Go to **Orders** tab
2. Find the fulfilled/delivered order
3. Click the **🔄 Sync** button in the Actions column
4. The system will:
   - Update tracking status from Geniki
   - Update Shopify delivery status
   - Mark COD payment as collected (if applicable)
5. Button shows success/failure feedback

### Bulk Order Sync

To sync multiple orders at once:

1. Go to **Orders** tab
2. **Select orders** using checkboxes (check fulfilled/delivered orders)
3. Click **"Sync Shopify (X)"** button in the header
4. Confirm the action
5. Wait for bulk sync to complete
6. Results shown in notification

**This is the easiest way!** No need to run code manually.

---

## 🚀 Two-Step Process

### Step 1: Backfill Fulfillment IDs

This retrieves and stores Shopify fulfillment IDs for orders that are already fulfilled.

**API Call:**
```bash
POST http://localhost:3000/api/backfill-fulfillment-ids
Content-Type: application/json

{
  "workspaceId": 2
}
```

**Using curl:**
```bash
curl -X POST http://localhost:3000/api/backfill-fulfillment-ids \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": 2}'
```

**What it does:**
- Finds all orders with `fulfillment_status = 'fulfilled'`
- Fetches their fulfillment details from Shopify
- Stores `shopify_fulfillment_id` in database
- Returns summary of updated orders

**Expected Response:**
```json
{
  "success": true,
  "message": "Backfilled 47 orders",
  "summary": {
    "total": 50,
    "updated": 47,
    "failed": 3
  },
  "results": [
    {
      "orderName": "INB#1001GR",
      "success": true,
      "fulfillmentId": "5234567890123",
      "trackingNumber": "5078012345"
    }
  ]
}
```

---

### Step 2: Re-sync Delivered Orders

This updates Shopify with delivery status and COD payments for historical orders.

**API Call:**
```bash
POST http://localhost:3000/api/resync-delivered-orders
Content-Type: application/json

{
  "workspaceId": 2,
  "forceAll": false
}
```

**Parameters:**
- `workspaceId` - Your workspace ID (required)
- `forceAll` - If `true`, re-syncs ALL delivered orders. If `false`, only syncs COD orders not yet marked as paid (default: false)

**Using curl:**
```bash
# Re-sync only COD orders needing payment update
curl -X POST http://localhost:3000/api/resync-delivered-orders \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": 2, "forceAll": false}'

# OR force re-sync all delivered orders
curl -X POST http://localhost:3000/api/resync-delivered-orders \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": 2, "forceAll": true}'
```

**What it does:**
- Gets tracking status from Geniki for delivered vouchers
- Updates Shopify fulfillments to "Delivered"
- Marks COD payments as collected
- Updates local database

**Expected Response:**
```json
{
  "success": true,
  "message": "Re-synced 47 orders",
  "summary": {
    "total": 47,
    "deliveryUpdated": 45,
    "paymentUpdated": 32,
    "failed": 2
  },
  "results": [
    {
      "voucherNumber": "5078012345",
      "success": true,
      "shopifyUpdated": true,
      "paymentUpdated": true
    }
  ]
}
```

---

## 📋 Complete Backfill Workflow

### Option A: Using API Calls (Recommended)

**Step-by-step:**

1. **Backfill fulfillment IDs:**
   ```bash
   curl -X POST http://localhost:3000/api/backfill-fulfillment-ids \
     -H "Content-Type: application/json" \
     -d '{"workspaceId": 2}'
   ```
   
   ⏱️ *Takes ~30 seconds per 50 orders*

2. **Wait 30 seconds** (let rate limits reset)

3. **Re-sync delivered orders:**
   ```bash
   curl -X POST http://localhost:3000/api/resync-delivered-orders \
     -H "Content-Type: application/json" \
     -d '{"workspaceId": 2, "forceAll": false}'
   ```
   
   ⏱️ *Takes ~30 seconds per 50 orders*

4. **Check results in Shopify**
   - Orders should show "Delivered" status
   - COD orders should show "Paid"

---

### Option B: Using Browser Console

1. **Open your app** in browser
2. **Open Developer Console** (F12)
3. **Run backfill:**
   ```javascript
   fetch('/api/backfill-fulfillment-ids', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ workspaceId: 2 })
   })
   .then(r => r.json())
   .then(console.log);
   ```

4. **Wait 30 seconds**

5. **Run re-sync:**
   ```javascript
   fetch('/api/resync-delivered-orders', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ workspaceId: 2, forceAll: false })
   })
   .then(r => r.json())
   .then(console.log);
   ```

---

## 🔍 Pre-Check: What Will Be Updated?

Before running backfill, check what orders will be affected:

### Check Orders Missing Fulfillment IDs

```sql
SELECT 
  o.order_name,
  o.shopify_order_id,
  o.fulfillment_status,
  v.voucher_number,
  v.shopify_fulfillment_id
FROM orders o
JOIN vouchers v ON o.order_name = v.order_name
WHERE o.workspace_id = 2
  AND o.fulfillment_status = 'fulfilled'
  AND v.shopify_fulfillment_id IS NULL
ORDER BY o.imported_at DESC;
```

### Check Delivered Orders Needing Payment Update

```sql
SELECT 
  o.order_name,
  v.voucher_number,
  o.payment_status,
  o.financial_status,
  o.total_price,
  v.delivered_at
FROM orders o
JOIN vouchers v ON o.order_name = v.order_name
WHERE o.workspace_id = 2
  AND v.delivered_at IS NOT NULL
  AND o.payment_status = 'cod'
  AND o.financial_status = 'pending'
ORDER BY v.delivered_at DESC;
```

---

## ⚠️ Important Notes

### Rate Limiting
- Shopify has rate limits (2 calls/second)
- Our scripts include 500ms delays between requests
- Large backfills (100+ orders) may take several minutes

### What Gets Updated
- **Only fulfilled orders** - Orders must already be fulfilled in Shopify
- **Only delivered orders** - For re-sync, only orders Geniki confirms as delivered
- **Only COD orders** - Payment updates only apply to COD orders

### What Doesn't Get Updated
- **Cancelled orders** - Skipped automatically
- **Unfulfilled orders** - No fulfillment ID to fetch
- **Already updated orders** - Skipped to avoid duplicates

### Safe to Run Multiple Times
- ✅ Idempotent operations
- ✅ Skips already-processed orders
- ✅ Won't create duplicate transactions
- ✅ Safe to re-run if it fails partway

---

## 📊 Verify Results

### After Backfill (Step 1):

```sql
-- Check how many fulfillment IDs were added
SELECT 
  COUNT(*) as total_fulfilled_orders,
  COUNT(shopify_fulfillment_id) as orders_with_fulfillment_id,
  COUNT(shopify_fulfillment_id) * 100.0 / COUNT(*) as percentage
FROM vouchers v
JOIN orders o ON v.order_name = o.order_name
WHERE o.workspace_id = 2
  AND o.fulfillment_status = 'fulfilled';
```

### After Re-sync (Step 2):

```sql
-- Check COD payments marked as collected
SELECT 
  COUNT(*) as delivered_cod_orders,
  COUNT(CASE WHEN o.financial_status = 'paid' THEN 1 END) as marked_as_paid,
  SUM(CASE WHEN o.financial_status = 'paid' THEN o.total_price ELSE 0 END) as total_collected
FROM orders o
JOIN vouchers v ON o.order_name = v.order_name
WHERE o.workspace_id = 2
  AND v.delivered_at IS NOT NULL
  AND o.payment_status = 'cod';
```

### Check in Shopify:

1. Go to Shopify Admin → Orders
2. Open a historical order that was delivered
3. Check:
   - ✅ Fulfillment status shows "Delivered"
   - ✅ If COD: Payment status shows "Paid"
   - ✅ Timeline shows payment transaction

---

## 🐛 Troubleshooting

### Error: "Order not found in Shopify"

**Cause:** Order name doesn't match Shopify  
**Solution:** Check if order was imported with correct name

```sql
SELECT order_name, shopify_order_id 
FROM orders 
WHERE order_name = 'INB#1001GR';
```

### Error: "No fulfillments found"

**Cause:** Order not actually fulfilled in Shopify  
**Solution:** Fulfill order in Shopify first, then run backfill

### Error: "Tracking number mismatch"

**Cause:** Shopify fulfillment has different tracking number  
**Solution:** Check if correct voucher is linked to order

```sql
SELECT o.order_name, v.voucher_number, o.shopify_order_id
FROM orders o
JOIN vouchers v ON o.order_name = v.order_name
WHERE o.order_name = 'INB#1001GR';
```

### Some Orders Skipped

**Check logs:**
```bash
# Server will log reasons:
# ℹ️  Order already marked as paid in Shopify
# ℹ️  Order is not a COD order, skipping payment update
# ⚠️  Could not find Shopify order for ORDER#123
```

---

## 📈 Expected Results

For a workspace with 100 delivered orders:

| Metric | Typical Result |
|--------|---------------|
| Orders with fulfillment IDs added | 95-100 |
| Delivery statuses updated | 90-95 |
| COD payments marked as paid | 50-60 (if ~60% are COD) |
| Failed updates | 0-5 |
| Time taken | 2-3 minutes |

---

## 🎯 Quick Commands

### Full Backfill (Both Steps):

```bash
# Step 1: Backfill fulfillment IDs
curl -X POST http://localhost:3000/api/backfill-fulfillment-ids \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": 2}'

# Wait 30 seconds...
sleep 30

# Step 2: Re-sync delivered orders
curl -X POST http://localhost:3000/api/resync-delivered-orders \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": 2, "forceAll": false}'
```

### Check Status:

```sql
-- Quick status check
SELECT 
  (SELECT COUNT(*) FROM vouchers WHERE workspace_id = 2 AND shopify_fulfillment_id IS NOT NULL) as with_fulfillment_id,
  (SELECT COUNT(*) FROM vouchers WHERE workspace_id = 2 AND delivered_at IS NOT NULL) as delivered,
  (SELECT COUNT(*) FROM orders WHERE workspace_id = 2 AND payment_status = 'cod' AND financial_status = 'paid') as cod_paid;
```

---

## ✅ Success Checklist

After running backfill, verify:

- [ ] Fulfillment IDs stored in database
- [ ] Shopify orders show "Delivered" status
- [ ] COD orders show "Paid" in Shopify
- [ ] Payment transactions visible in Shopify order timeline
- [ ] UI shows pale green "✓ Delivered" buttons
- [ ] No errors in server logs

---

## 📞 Need Help?

**Check server logs:**
```bash
tail -f server.log | grep -E "(Backfill|Re-sync|fulfillment)"
```

**Common fixes:**
1. Restart server if needed
2. Check Shopify credentials are valid
3. Verify workspace ID is correct
4. Check Shopify rate limits not exceeded

---

**You're all set! Run the backfill and your historical orders will be updated.** 🚀

