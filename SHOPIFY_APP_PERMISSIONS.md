# 🔐 Shopify Custom App Permissions Guide

## Required Permissions for Full Integration

This document outlines the **exact Shopify permissions** you need to grant your custom app to enable all features in the eTrack application.

---

## 📋 Overview

Your app performs these operations:
- ✅ **Read orders** (fetch order details, search orders)
- ✅ **Create fulfillments** (mark orders as shipped with tracking)
- ✅ **Update fulfillments** (mark as delivered)
- ✅ **Create transactions** (mark COD orders as paid)
- ✅ **Read locations** (get warehouse/store locations)
- ✅ **Read products** (from order line items)

---

## 🎯 Required Admin API Access Scopes

When creating your **Custom App** in Shopify, grant these scopes:

### 1. **Orders** ✅
**Scope:** `read_orders` + `write_orders`

**Why needed:**
- Fetch order details from Shopify
- Search orders by name
- Read order financial status
- Read order fulfillment status
- Sync fulfillment status from Shopify to your database

**Operations:**
```
GET /orders/{order_id}.json
GET /orders.json?name={order_name}&status=any
GET /orders.json?limit=50
```

---

### 2. **Fulfillments** ✅
**Scope:** `read_fulfillments` + `write_fulfillments`

**Why needed:**
- Create fulfillments (mark orders as shipped)
- Add tracking numbers to orders
- Update fulfillment status (mark as delivered)
- Read fulfillment orders
- Send customer notifications

**Operations:**
```
GET /orders/{order_id}/fulfillment_orders.json
POST /fulfillments.json
POST /orders/{order_id}/fulfillments/{fulfillment_id}/events.json
```

---

### 3. **Locations** ✅
**Scope:** `read_locations`

**Why needed:**
- Get warehouse/store locations for fulfillments
- Assign fulfillments to correct location
- Required by Shopify fulfillment API

**Operations:**
```
GET /locations.json
```

---

### 4. **Inventory** ⚠️ (Optional but Recommended)
**Scope:** `read_inventory`

**Why needed:**
- Read product inventory levels
- Useful for future stock sync features

**Operations:**
```
GET /inventory_items.json
GET /inventory_levels.json
```

---

### 5. **Products** ⚠️ (Optional)
**Scope:** `read_products`

**Why needed:**
- Read product details from orders
- Get product images and descriptions
- Already included in order data, but this allows direct product queries

**Operations:**
```
GET /products/{product_id}.json
GET /products.json
```

---

## 🛠️ How to Create a Shopify Custom App

### Step 1: Access Shopify Admin
1. Log into your Shopify store admin panel
2. Go to **Settings** → **Apps and sales channels**
3. Click **Develop apps**
4. Click **Allow custom app development** (if first time)

### Step 2: Create the App
1. Click **Create an app**
2. Enter app name: `eTrack Integration` (or any name)
3. Click **Create app**

### Step 3: Configure API Scopes
1. Click **Configure Admin API scopes**
2. Scroll down and enable these scopes:

#### ✅ Required (MUST HAVE):
```
☑️ read_orders
☑️ write_orders
☑️ read_fulfillments
☑️ write_fulfillments
☑️ read_locations
```

#### ⚠️ Recommended (OPTIONAL):
```
☐ read_inventory
☐ read_products
```

3. Click **Save**

### Step 4: Install the App
1. Click **Install app**
2. Review the permissions
3. Click **Install app**

### Step 5: Get API Credentials
1. After installation, you'll see:
   - **Admin API access token** (starts with `shpat_...`)
   - **API key**
   - **API secret key**

2. **IMPORTANT:** Copy the **Admin API access token** immediately - you won't be able to see it again!

### Step 6: Configure in eTrack
1. Log into your eTrack dashboard (http://91.98.94.41)
2. Go to **Settings** → **Integrations**
3. Under **Shopify Integration**, enter:
   - **Shopify Shop Domain**: `your-store.myshopify.com`
   - **Access Token**: `shpat_xxxxxxxxxxxxxxxxxxxxx`
4. Click **Save**

---

## 🔒 Security Best Practices

### ✅ DO:
- Store the access token securely in your workspace settings
- Never share your access token publicly
- Regenerate tokens if compromised
- Use separate custom apps for different stores/workspaces

### ❌ DON'T:
- Don't grant unnecessary permissions
- Don't share access tokens via email or chat
- Don't commit tokens to Git repositories
- Don't use the same token for multiple environments (dev/prod)

---

## 🧪 Testing Your Integration

After configuring the app, test these features:

1. **Fetch Orders**
   - Go to Orders page
   - Check if orders display correctly

2. **Create Fulfillment**
   - Select an order with a tracking number
   - Click "Fulfill in Shopify"
   - Verify in Shopify admin that order is marked as fulfilled

3. **Sync from Shopify**
   - Go to Orders page
   - Click "Bulk Actions" → "Sync from Shopify"
   - Verify that already-fulfilled orders are synced

4. **Update Tracking**
   - Select fulfilled orders
   - Click "Update Tracking"
   - Verify tracking updates appear in Shopify

---

## 🐛 Troubleshooting

### Error: "Access denied for scope"
**Solution:** Make sure you granted the required scopes listed above.

### Error: "Invalid API credentials"
**Solution:** 
1. Check that you copied the access token correctly
2. Verify the shop domain is correct (`your-store.myshopify.com`)
3. Make sure the custom app is installed

### Error: "Could not fetch locations"
**Solution:** Grant `read_locations` scope to your custom app.

### Error: "Fulfillment order not found"
**Solution:** 
1. Make sure the order exists in Shopify
2. Verify the order hasn't been archived
3. Check that fulfillment orders exist for the order

---

## 📚 Additional Resources

- [Shopify Admin API Documentation](https://shopify.dev/docs/api/admin-rest)
- [Fulfillment API Guide](https://shopify.dev/docs/api/admin-rest/2024-01/resources/fulfillment)
- [Orders API Guide](https://shopify.dev/docs/api/admin-rest/2024-01/resources/order)
- [Locations API Guide](https://shopify.dev/docs/api/admin-rest/2024-01/resources/location)

---

## 📞 Support

If you encounter issues with Shopify permissions:
1. Double-check the scopes listed above
2. Verify the access token is valid
3. Test the connection in Settings → Integrations
4. Check the server logs for detailed error messages

---

**Last Updated:** November 27, 2025  
**App Version:** eTrack v1.0  
**Shopify API Version:** 2024-01


