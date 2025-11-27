# 🚀 Geniki Taxydromiki Setup Instructions

## 📋 Complete Production System with PostgreSQL & File Upload

### ✅ **SYSTEM FEATURES:**
- 📁 **File Upload**: Drag & drop CSV files (no more pasting!)
- 🗄️ **PostgreSQL Database**: Persistent storage of all orders and vouchers
- 📊 **Order Tracking**: View processing history and voucher status
- 🏷️ **Bulk Processing**: Handle hundreds of orders efficiently  
- 🔄 **Complete Integration**: Shopify ↔ PostgreSQL ↔ Geniki

---

## 🛠️ **INSTALLATION STEPS:**

### **1. Install PostgreSQL**
```bash
# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Create database
createdb geniki_orders

# Run database setup
psql -d geniki_orders -f database-setup.sql
```

### **2. Configure Environment**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your details:
# - Shopify store URL and access token
# - PostgreSQL credentials  
# - Geniki API keys (test or production)
```

### **3. Install Dependencies & Start**
```bash
npm install
npm start
```

### **4. Access Web Interface**
Open: **http://localhost:3000**

---

## 🎯 **HOW TO USE:**

### **Step 1: Export from Shopify**
- **Shopify Admin** → **Orders** → **Export** → Download CSV

### **Step 2: Upload & Process**  
- Open **http://localhost:3000**
- **Drag & drop** your CSV file (or click to browse)
- Click **"Upload & Import"**
- View imported orders with status

### **Step 3: Create Vouchers**
- **Individual**: Click "Create Voucher" for specific orders
- **Bulk**: Click "Create All Vouchers" for batch processing
- **Download Labels**: Click "PDF" button for shipping labels

---

## 📊 **DATABASE FEATURES:**

### **Persistent Storage:**
- ✅ All orders saved permanently
- ✅ Voucher numbers and status tracked
- ✅ Processing history maintained
- ✅ Import audit trail

### **Order Status Tracking:**
- 🔴 **Pending**: Orders waiting for voucher creation
- 🟢 **Processed**: Orders with vouchers created
- 📋 **Voucher Numbers**: Track all Geniki voucher IDs
- 📄 **PDF Downloads**: Direct access to shipping labels

### **View Data:**
```sql
-- See all orders with vouchers
SELECT * FROM orders_with_vouchers;

-- Get daily statistics
SELECT DATE(created_at), COUNT(*), SUM(total_price) 
FROM orders 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

---

## 🔧 **PRODUCTION DEPLOYMENT:**

### **1. Database Setup**
- Use managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
- Update `.env` with production database credentials

### **2. Server Deployment**
```bash
# Set production environment
NODE_ENV=production

# Use production Geniki credentials
GENIKI_USERNAME=your_prod_username
GENIKI_PASSWORD=your_prod_password
GENIKI_APPKEY=your_prod_app_key
```

### **3. Security**
- Use HTTPS in production
- Set secure database passwords
- Configure firewall rules
- Regular database backups

---

## 🎉 **WHAT THIS SOLVES:**

| Old Problem | New Solution |
|------------|-------------|
| ❌ Shopify Basic Plan limitations | ✅ CSV export bypasses API restrictions |
| ❌ Manual voucher creation | ✅ Bulk processing in clicks |
| ❌ No order tracking | ✅ Complete database history |
| ❌ Lost voucher numbers | ✅ Persistent storage with status |
| ❌ Copy/paste CSV data | ✅ Professional file upload |

---

## 📞 **SUPPORT:**

- **Database Issues**: Check PostgreSQL connection and credentials
- **File Upload**: Ensure CSV format matches Shopify export
- **Geniki API**: Verify test vs production credentials
- **Shopify Access**: Confirm app has required permissions

**Ready for production use with hundreds of orders daily!** 🚀


