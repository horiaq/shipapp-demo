# Tracking Status Implementation Guide

**Implementation Date:** November 24, 2025  
**Feature:** Automatic tracking status updates from Geniki Taxydromiki API

---

## 📋 Overview

This implementation adds automatic tracking status updates for all vouchers using the Geniki Taxydromiki TrackDeliveryStatus API. The system updates voucher delivery statuses twice daily (10:00 AM and 6:00 PM Greek time) and provides a manual refresh option.

---

## ✅ What Was Implemented

### 1. **Database Schema** (`database-tracking-migration.sql`)

Added new fields to `vouchers` table:
- `delivery_status` - Human-readable status (e.g., "In Transit", "Delivered")
- `delivery_status_code` - Geniki API status code
- `delivery_status_updated_at` - Last update timestamp
- `delivered_at` - Delivery timestamp
- `current_location` - Current location/shop code
- `tracking_checkpoints` - JSON array of all checkpoints
- `last_tracking_error` - Last error message

Created `tracking_sync_log` table to track update operations:
- Logs each sync operation
- Tracks success/failure counts
- Records errors for debugging

**To apply the migration:**
```bash
psql -U horiaq -d geniki_orders -f database-tracking-migration.sql
```

---

### 2. **Backend API Integration** (`server.js`)

#### New Functions:

**`trackDeliveryStatus(voucherNumber, language)`**
- Calls Geniki's TrackDeliveryStatus API
- Returns current delivery status and location
- Handles authentication automatically

**`trackAndTrace(voucherNumber, language)`**
- Gets full checkpoint history for a voucher
- More detailed than TrackDeliveryStatus
- Useful for detailed tracking views

**`updateVoucherTrackingStatus(voucherNumber, workspaceId)`**
- Updates a single voucher's tracking status in database
- Handles errors gracefully
- Sets `delivered_at` timestamp when delivered

**`updateAllVoucherTrackingStatuses(workspaceId)`**
- Updates all active vouchers (not yet delivered, created in last 30 days)
- Includes rate limiting (100ms delay between requests)
- Logs all operations to `tracking_sync_log`

#### New API Endpoints:

**POST `/api/tracking/update-all`**
- Manually trigger tracking update for all vouchers
- Request body: `{ workspaceId: number }`
- Response: Summary with total/updated/errors counts

**POST `/api/vouchers/:voucherNumber/update-tracking`**
- Update tracking for a single voucher
- Request body: `{ workspaceId: number }`
- Response: Updated tracking data and voucher info

**GET `/api/tracking/sync-log`**
- Get tracking sync history
- Query params: `workspaceId`, `limit` (default: 10)
- Response: Array of sync log entries

**GET `/api/vouchers/:voucherNumber/tracking`**
- Get detailed tracking info with checkpoint history
- Query params: `workspaceId`, `language` (default: 'en')
- Response: Full tracking data from Geniki

---

### 3. **Scheduled Jobs** (node-cron)

**Automatic Updates:**
- **Schedule:** Twice daily at 10:00 AM and 6:00 PM
- **Timezone:** Europe/Athens (Greek time)
- **Cron Expression:** `'0 10,18 * * *'`
- **Action:** Updates all workspaces automatically

**How it works:**
1. Runs at scheduled times
2. Gets all active workspaces
3. For each workspace:
   - Fetches all active vouchers (not delivered, < 30 days old)
   - Updates tracking status from Geniki API
   - Logs results to `tracking_sync_log`
4. Includes 1 second delay between workspaces to avoid rate limiting

---

### 4. **Frontend UI** (`public/index.html`)

#### New "Update Tracking" Button
- Located in header actions (next to Refresh button)
- Icon: 📍 (map-pin)
- Triggers manual update for all vouchers in current workspace
- Shows progress indicator while running

#### New "Delivery" Column in Orders Table
- Displays delivery status badge with icon
- Shows current location if available
- Includes refresh button (🔄) per voucher
- Status badges color-coded:
  - ✅ Green: Delivered
  - 🚚 Blue: In Transit
  - ↩️ Red: Returned
  - ⏳ Gray: Pending
  - 📦 Default: Other

#### New JavaScript Functions:

**`updateAllTracking()`**
- Calls `/api/tracking/update-all` endpoint
- Shows confirmation dialog
- Displays progress and results
- Reloads orders table when complete

**`updateSingleTracking(voucherNumber)`**
- Updates single voucher's tracking
- Called when clicking refresh button (🔄)
- Shows status popup with results

**`getDeliveryStatusClass(status)`**
- Returns appropriate CSS badge class based on status
- Handles Greek and English status text

**`getDeliveryStatusIcon(status)`**
- Returns appropriate emoji icon for status
- Improves visual recognition

#### New CSS Styles:

**`.col-delivery`**
- Width: 150px
- Center-aligned
- Displays status badge and location

**`.badge-canceled`**
- Red background (#fee2e2)
- Red text (#dc2626)
- Used for returned packages

---

## 🚀 How to Use

### Manual Tracking Update

1. Click **"Update Tracking"** button in header
2. Confirm the action
3. Wait for the update to complete (1-3 minutes for 100 vouchers)
4. View updated statuses in the "Delivery" column

### Single Voucher Tracking

1. Find the voucher in the table
2. In the "Delivery" column, click the **🔄** refresh button
3. Status updates immediately

### View Sync History

Use the API endpoint:
```bash
GET /api/tracking/sync-log?workspaceId=1&limit=10
```

---

## 📊 Tracking Status Examples

| Geniki Status | Icon | Badge Color | Meaning |
|--------------|------|-------------|---------|
| Delivered | ✅ | Green | Package delivered |
| In Transit | 🚚 | Blue | Package is shipping |
| Returned | ↩️ | Red | Package returned |
| Pending | ⏳ | Gray | Not yet shipped |
| Other | 📦 | Default | Other status |

---

## 🔧 Configuration

### Scheduled Job Times

To change the update schedule, edit `server.js`:

```javascript
// Current: 10:00 AM and 6:00 PM
cron.schedule('0 10,18 * * *', async () => { ... });

// Example: Every 6 hours
cron.schedule('0 */6 * * *', async () => { ... });

// Example: Only 3:00 PM daily
cron.schedule('0 15 * * *', async () => { ... });
```

### Timezone

Default is `Europe/Athens` (Greek time). Change in the cron job options:

```javascript
cron.schedule('0 10,18 * * *', async () => { ... }, {
  scheduled: true,
  timezone: "Europe/Athens" // Change this
});
```

### Rate Limiting

Current delay between API requests: **100ms**

To change, edit in `updateAllVoucherTrackingStatuses()`:

```javascript
await new Promise(resolve => setTimeout(resolve, 100)); // Change 100 to desired milliseconds
```

---

## 🐛 Troubleshooting

### Issue: Tracking not updating

**Check:**
1. Verify cron job is running (check server console logs)
2. Check `tracking_sync_log` table for errors
3. Verify Geniki API credentials are valid
4. Check network connectivity

**Solution:**
```sql
-- Check recent sync logs
SELECT * FROM tracking_sync_log ORDER BY sync_started_at DESC LIMIT 10;

-- Check vouchers with errors
SELECT voucher_number, last_tracking_error 
FROM vouchers 
WHERE last_tracking_error IS NOT NULL;
```

### Issue: "Permission denied" errors

**Cause:** Geniki API requires proper scopes

**Solution:** Verify your Geniki API account has access to TrackDeliveryStatus method

### Issue: Slow updates

**Cause:** Too many vouchers or rate limiting

**Solutions:**
1. Increase delay between requests (currently 100ms)
2. Reduce the age limit (currently 30 days) in the query:
   ```sql
   AND created_at > NOW() - INTERVAL '30 days' -- Change this
   ```

---

## 📈 Performance Considerations

- **Rate Limiting:** 100ms delay between requests = max 10 requests/second
- **Batch Size:** Updates all active vouchers (not delivered, < 30 days)
- **Typical Performance:** 
  - 100 vouchers = ~10 seconds
  - 500 vouchers = ~50 seconds
  - 1000 vouchers = ~100 seconds (1.6 minutes)

---

## 🔮 Future Enhancements

Potential improvements:
1. **Email Notifications:** Alert when package is delivered
2. **Webhook Integration:** Real-time updates from Geniki (if available)
3. **Customer Portal:** Allow customers to track their own packages
4. **Analytics Dashboard:** Track delivery performance metrics
5. **Retry Logic:** Automatic retry for failed updates
6. **Checkpoint History:** Store and display full tracking history

---

## 📚 API Reference

### Geniki TrackDeliveryStatus

According to [Geniki API Documentation](https://voucher.taxydromiki.gr/HELP/JOBSERVICESAPIV2.PDF):

```
TrackDeliveryStatusResult TrackDeliveryStatus(string authKey, string voucherNo, string language)
```

**Returns:**
- `IsDelivered` - Boolean
- `StatusCode` - Status code
- `StatusDescription` - Human-readable status
- `Location` - Current location
- `ShopCode` - Shop/destination code

---

## ✅ Implementation Checklist

- [x] Database schema created
- [x] Migration applied
- [x] Backend API functions implemented
- [x] API endpoints created
- [x] Scheduled job configured
- [x] Frontend UI updated
- [x] CSS styles added
- [x] Testing completed
- [x] Documentation created

---

## 🎉 Summary

The tracking status feature is now fully implemented and operational. The system will automatically update delivery statuses twice daily, and users can manually trigger updates anytime. All voucher statuses are now visible in the orders table with color-coded badges and icons for easy recognition.

**Next Steps:**
1. Monitor the first few automatic updates
2. Check for any errors in `tracking_sync_log`
3. Adjust schedule/rate limiting if needed
4. Consider implementing email notifications for deliveries

---

*For questions or issues, refer to the Geniki API documentation or check the server console logs.*

