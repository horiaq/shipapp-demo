# Shopify Order Fulfillment Guide

## ✅ Setup Complete!

Your InBreath workspace has been successfully configured with Shopify fulfillment capabilities.

### Workspace Details
- **Workspace ID**: 2
- **Store Name**: InBreath Store
- **Shopify URL**: inbreath-2.myshopify.com
- **Location**: Frasinului 3, Rasnov Brașov, Romania
- **Status**: Active ✅

---

## 📦 How Order Fulfillment Works

### The Complete Workflow

```
1. Order placed in Shopify
   ↓
2. Import order to your app (CSV or Manual)
   ↓
3. Create Geniki voucher/label
   ↓
4. Click "Fulfill" button
   ↓
5. Order marked as fulfilled in Shopify
   + Tracking number added automatically
   + Customer receives email notification
```

---

## 🎯 Using the Fulfillment Feature

### Option 1: Fulfill Individual Orders

1. **Navigate to Orders Tab**
2. Find the order you want to fulfill
3. Make sure it has a voucher/tracking number (click "Create Voucher" if not)
4. Click the **"Fulfill"** button in the Actions column
5. Confirm the action
6. ✅ Done! Customer will be notified with tracking info

### Option 2: Bulk Fulfill Multiple Orders

1. **Navigate to Orders Tab**
2. **Select orders** using checkboxes (only select orders with vouchers!)
3. Click **"Fulfill Orders (X)"** button at the top
4. Confirm the bulk action
5. ✅ All selected orders will be fulfilled in one go!

---

## ⚠️ Important Requirements

### Before Fulfilling an Order:

✅ **Order must have a voucher/tracking number**
   - Create voucher first using "Create Voucher" button
   - Geniki assigns tracking number automatically

✅ **Order must have Shopify Order ID**
   - Orders imported via CSV need Shopify order ID
   - Orders from Shopify API have this automatically

✅ **Order must not be already fulfilled**
   - Shopify won't let you fulfill the same order twice
   - Check fulfillment status in Shopify admin

---

## 🔧 What Happens When You Fulfill?

### Automatic Actions:

1. **✉️ Customer Email Notification**
   - Shopify sends email to customer
   - Includes tracking number
   - Includes tracking URL: `https://www.taxydromiki.com/track/[TRACKING_NUMBER]`

2. **📊 Shopify Order Status Update**
   - Order status changes to "Fulfilled"
   - Fulfillment record created with:
     - Tracking Company: "Geniki Taxydromiki"
     - Tracking Number: [Your voucher number]
     - Location: Frasinului 3 (or your configured location)

3. **🎯 Customer Can Track**
   - Customer clicks tracking link in email
   - Redirected to Geniki tracking page
   - Can see real-time shipment status

---

## 🚨 Troubleshooting

### Error: "Order does not have a voucher/tracking number"
**Solution**: Create a voucher first using the "Create Voucher" button

### Error: "Order does not have a Shopify order ID"
**Solution**: This order was imported from CSV without Shopify ID. You need to manually update it or skip fulfillment.

### Error: "No items to fulfill (order may already be fulfilled)"
**Solution**: Order is already fulfilled in Shopify. Check Shopify admin.

### Error: "No fulfillment location found for this store"
**Solution**: Contact support - your Shopify store needs at least one location configured.

---

## 💡 Best Practices

### Recommended Workflow:

1. **Morning**: Import new orders from Shopify or CSV
2. **Create Vouchers**: Bulk create vouchers for all pending orders
3. **Print Labels**: Download and print all labels
4. **After Printing**: Use bulk fulfill to mark all as shipped
5. **Before Pickup**: Click "Send Labels to Geniki" (finalizes with courier)

### Tips:

- ✅ Always create vouchers before fulfilling
- ✅ Use bulk operations for efficiency
- ✅ Check Shopify admin to verify fulfillments
- ✅ Test with 1-2 orders first before bulk fulfilling
- ⚠️ Don't fulfill orders before packages are ready to ship!

---

## 📊 Shopify Basic Plan & PII Limitations

### Good News! ✅

**You CAN fulfill orders on Basic plan!** 

The PII (Personally Identifiable Information) limitation on Shopify Basic plan only affects:
- Reading customer email/phone via certain APIs
- Accessing customer profiles directly

It **DOES NOT** affect:
- ✅ Reading orders
- ✅ Creating fulfillments
- ✅ Adding tracking numbers
- ✅ Sending fulfillment notifications

### How We Handle It:

- We get customer info from **order data** (not customer profiles)
- Fulfillment API uses order ID (no PII restrictions)
- Shopify handles email notifications (built-in feature)

---

## 🔐 Security & Credentials

### Stored Securely:

- ✅ Shopify Access Token: Encrypted in database
- ✅ Per-workspace credentials: Isolated by workspace ID
- ✅ API calls: Direct HTTPS to Shopify

### Your Credentials:

```
Store: inbreath-2.myshopify.com
Access Token: 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
API Scopes:
  - read_orders
  - write_orders  
  - read_fulfillments
  - write_fulfillments ✅ (needed for fulfillment)
```

---

## 🧪 Testing the Feature

### Test Checklist:

1. ✅ **Test Single Fulfillment**
   - Create test order in Shopify
   - Import to your app
   - Create voucher
   - Click "Fulfill"
   - Check Shopify admin for fulfillment
   - Check if customer received email

2. ✅ **Test Bulk Fulfillment**
   - Select 2-3 orders with vouchers
   - Click "Fulfill Orders"
   - Verify all were fulfilled in Shopify

3. ✅ **Test Error Handling**
   - Try to fulfill order without voucher (should fail gracefully)
   - Try to fulfill already fulfilled order (should show error)

---

## 📞 Support & Questions

### Need Help?

- Check Shopify Admin → Orders to verify fulfillments
- Check browser console (F12) for detailed error messages
- Contact Geniki if tracking URLs aren't working

### Common Questions:

**Q: Can I undo a fulfillment?**
A: Not automatically. You'll need to manually cancel fulfillment in Shopify admin.

**Q: What if customer doesn't receive email?**
A: Check spam folder. Also verify email is correct in order details.

**Q: Can I customize the tracking URL?**
A: Currently set to `https://www.taxydromiki.com/track/`. Contact Geniki if you need custom domain.

---

## 🎉 You're All Set!

Your fulfillment system is ready to use. Start with a test order to see the complete workflow in action!

**Happy Shipping! 📦✨**

