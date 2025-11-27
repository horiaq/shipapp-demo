# Order Status System - Complete Guide

## Overview

The system now has **7 distinct order statuses** that track the complete lifecycle of an order from creation to completion. Each status has a unique color for easy visual identification.

## Status Flow

```
Unfulfilled → AWB Created → Sent → In Transit → Delivered/Returned → Completed
```

## Status Definitions

### 1. 🔲 Unfulfilled (Gray - #64748b)
- **When**: New order just came in, nothing has been done yet
- **Conditions**: 
  - No voucher/AWB created
  - Order exists in system but hasn't been processed
- **User Action Needed**: Create voucher/label for the order

### 2. 🟣 AWB Created (Purple - #8b5cf6)
- **When**: Label/voucher has been created for the order
- **Conditions**:
  - Voucher number exists
  - NOT yet sent to Geniki (sent_to_geniki = FALSE)
- **User Action Needed**: Send orders to Geniki via "Send Orders" bulk action

### 3. 🔵 Sent (Blue - #3b82f6)
- **When**: Vouchers have been sent/closed with Geniki
- **Conditions**:
  - Voucher exists
  - sent_to_geniki = TRUE
  - No tracking status yet
- **User Action Needed**: Wait for Geniki to pick up packages, then update tracking

### 4. 🔷 In Transit (Cyan - #06b6d4)
- **When**: Package has been picked up and is on the way
- **Conditions**:
  - Has delivery_status from tracking
  - Status does NOT include "DELIVERED" or "RETURN"
  - Package is actively being transported
- **User Action Needed**: Monitor tracking updates

### 5. 🟢 Delivered (Green - #10b981)
- **When**: Package has been delivered to customer
- **Conditions**:
  - delivery_status includes "DELIVERED"
  - NOT a return
  - delivered_at timestamp exists
- **User Action Needed**: Create invoice, sync with Shopify, collect payment

### 6. 🔴 Returned (Red - #ef4444)
- **When**: Package returned to sender
- **Conditions**:
  - delivery_status includes "RETURN" or "ΕΠΙΣΤΡΟΦΗ"
  - current_location includes "SENDER" or "ΑΠΟΣΤΟΛ"
- **User Action Needed**: Contact customer, process refund/reshipping

### 7. 🟩 Completed (Emerald - #059669)
- **When**: Order fully completed - invoice created, Shopify synced, payment collected
- **Conditions**:
  - oblio_invoice_id exists (invoice created)
  - shopify_fulfillment_id exists OR fulfillment_status = 'fulfilled'
  - financial_status = 'paid' OR payment_status = 'paid'
  - delivered_at exists
- **User Action Needed**: None - order is complete!

## Implementation Details

### Database Schema

#### New Columns Added:
```sql
-- orders table
ALTER TABLE orders ADD COLUMN order_status VARCHAR(50) DEFAULT 'unfulfilled';
CREATE INDEX idx_orders_order_status ON orders(order_status);

-- vouchers table
ALTER TABLE vouchers ADD COLUMN sent_to_geniki BOOLEAN DEFAULT FALSE;
ALTER TABLE vouchers ADD COLUMN sent_to_geniki_at TIMESTAMP;
CREATE INDEX idx_vouchers_sent_to_geniki ON vouchers(sent_to_geniki);
```

### Backend Logic

**File**: `server.js`

**Function**: `calculateOrderStatus(order)`
- Dynamically calculates status based on order and voucher data
- Called automatically when fetching orders via `getAllOrders()`
- Returns one of: `unfulfilled`, `awb_created`, `sent`, `in_transit`, `delivered`, `returned`, `completed`

**Automatic Status Updates**:
1. When voucher created: Status becomes `awb_created`
2. When "Send Orders" executed: `sent_to_geniki = TRUE`, status becomes `sent`
3. When tracking updated: Status becomes `in_transit`, `delivered`, or `returned` based on tracking data
4. When invoice + Shopify sync + payment done: Status becomes `completed`

### Frontend Implementation

**Files Modified**:
1. `frontend/lib/utils/orderHelpers.ts` - getOrderStatus() function
2. `frontend/lib/types/index.ts` - Order interface updated
3. `frontend/app/globals.css` - 7 status color definitions
4. `frontend/components/OrdersTable/OrdersTable.tsx` - Status filter dropdown

**Status Badge CSS Classes**:
```css
.status-unfulfilled
.status-awb_created
.status-sent
.status-in_transit
.status-delivered
.status-returned
.status-completed
```

## Bulk Actions & Status Changes

### Create Vouchers
- **Changes**: `unfulfilled` → `awb_created`
- **Database**: Creates voucher record

### Send Orders (Close Pending)
- **Changes**: `awb_created` → `sent`
- **Database**: Sets `sent_to_geniki = TRUE`, `sent_to_geniki_at = CURRENT_TIMESTAMP`
- **Geniki API**: Calls `ClosePendingJobs` or `ClosePendingJobsByDate`

### Update Tracking
- **Changes**: `sent` → `in_transit` / `delivered` / `returned`
- **Database**: Updates `delivery_status`, `delivery_status_updated_at`, `delivered_at`
- **Geniki API**: Fetches tracking status for each voucher

### Create Invoices
- **Changes**: Part of moving toward `completed`
- **Database**: Sets `oblio_invoice_id`, `oblio_invoice_number`, etc.
- **Oblio API**: Creates invoice in Oblio system

### Sync Shopify
- **Changes**: `delivered` → `completed` (if other conditions met)
- **Database**: Sets `shopify_fulfillment_id`, updates `fulfillment_status`
- **Shopify API**: Creates/updates fulfillment

## Color Palette

| Status | Color Name | Hex Code | RGB | Use Case |
|--------|-----------|----------|-----|----------|
| Unfulfilled | Slate | #64748b | rgb(100, 116, 139) | Neutral, waiting |
| AWB Created | Purple | #8b5cf6 | rgb(139, 92, 246) | Action taken, preparing |
| Sent | Blue | #3b82f6 | rgb(59, 130, 246) | Active, in system |
| In Transit | Cyan | #06b6d4 | rgb(6, 182, 212) | Moving, dynamic |
| Delivered | Green | #10b981 | rgb(16, 185, 129) | Success, arrived |
| Returned | Red | #ef4444 | rgb(239, 68, 68) | Problem, needs attention |
| Completed | Emerald | #059669 | rgb(5, 150, 105) | Final success, all done |

## Migration Steps

### 1. Run Database Migration
```bash
psql -U your_user -d geniki_orders -f database-order-status-migration.sql
```

This will:
- Add `order_status` column to orders table
- Add `sent_to_geniki` and `sent_to_geniki_at` columns to vouchers table
- Migrate existing data to have correct statuses
- Create necessary indexes

### 2. Restart Backend Server
```bash
cd /path/to/project
node server.js
```

The new `calculateOrderStatus()` function will automatically calculate statuses for all orders.

### 3. Clear Frontend Cache (if needed)
```bash
cd frontend
rm -rf .next
npm run dev
```

## Testing Checklist

- [ ] Unfulfilled orders display with gray badge
- [ ] After creating voucher, status changes to AWB Created (purple)
- [ ] After sending orders, status changes to Sent (blue)
- [ ] After tracking update shows pickup, status changes to In Transit (cyan)
- [ ] After tracking shows delivered, status changes to Delivered (green)
- [ ] After tracking shows return, status changes to Returned (red)
- [ ] After invoice + Shopify sync + payment, status changes to Completed (emerald)
- [ ] Status filter dropdown shows all 7 statuses
- [ ] Colors are visually distinct in both light and dark mode

## API Response Format

When fetching orders, each order now includes:

```json
{
  "orderName": "CLO#1234GR",
  "orderStatus": "in_transit",
  "voucherNumber": "6123456789",
  "deliveryStatus": "ΣΤΑΘΜΟΣ ΕΞΕΡΧΟΜΕΝΩΝ",
  "sentToGeniki": true,
  "sentToGenikiAt": "2024-01-15T10:30:00Z",
  // ... other order fields
}
```

## Troubleshooting

### Status not updating after action
- Check that backend has latest code
- Verify database migration ran successfully
- Check browser console for API errors
- Refresh the orders list

### Wrong status showing
- Check order has correct voucher data
- Verify tracking data is up to date
- Check `sent_to_geniki` field in database
- Review `calculateOrderStatus()` logic

### Colors not showing correctly
- Clear browser cache
- Check CSS is loaded (inspect element)
- Verify className format: `status-{status_name}` with underscores

## Future Enhancements

Potential improvements for the status system:

1. **Status History**: Track when each status change occurred
2. **Notifications**: Alert users when orders change status
3. **Dashboard Chart**: Update Order Status chart to use real data with 7 statuses
4. **Filters**: Add ability to filter orders by multiple statuses
5. **Bulk Status Update**: Manually change status for multiple orders
6. **Status Timeline**: Visual timeline showing order progression
7. **Webhooks**: Notify external systems when status changes

## Support

For questions or issues with the order status system:
- Check this documentation first
- Review database migration results
- Check server logs for errors
- Inspect browser console for frontend errors

