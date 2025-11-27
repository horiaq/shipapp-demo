// server.js - Complete Geniki + Shopify Integration Backend
require('dotenv').config();
const express = require('express');
const soap = require('soap');
const axios = require('axios');
const crypto = require('crypto');
const { Pool } = require('pg');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Serve your React app

// ==================== DATABASE CONFIGURATION ====================
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'geniki_orders',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.on('connect', () => {
  console.log('📊 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// File upload configuration
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// ==================== CONFIGURATION ====================
const CONFIG = {
  geniki: {
    testUrl: 'https://testvoucher.taxydromiki.gr/JobServicesV2.asmx?WSDL',
    liveUrl: 'https://voucher.taxydromiki.gr/JobServicesV2.asmx?WSDL',
    username: process.env.GENIKI_USERNAME || 'clotest',
    password: process.env.GENIKI_PASSWORD || '700149@',
    appKey: process.env.GENIKI_APPKEY || 'D8E50F4B-E372-4CFC-8330-EEF2B8D6D478',
    isTestMode: process.env.NODE_ENV !== 'production'
  },
  shopify: {
    shop: process.env.SHOPIFY_SHOP, // your-store.myshopify.com
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: '2025-01',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET
  }
};

// Auth cache (use Redis in production)
let authCache = {
  key: null,
  expiresAt: null
};

// ==================== GENIKI API FUNCTIONS ====================

async function getGeinikiClient() {
  const url = CONFIG.geniki.isTestMode ? CONFIG.geniki.testUrl : CONFIG.geniki.liveUrl;
  return await soap.createClientAsync(url);
}

async function authenticate() {
  // Return cached key if still valid (with 5 min buffer)
  if (authCache.key && authCache.expiresAt && new Date() < new Date(authCache.expiresAt - 5 * 60 * 1000)) {
    console.log('Using cached auth key');
    return authCache.key;
  }

  console.log('Authenticating with Geniki...');
  const client = await getGeinikiClient();
  
  const result = await client.AuthenticateAsync({
    sUsrName: CONFIG.geniki.username,
    sUsrPwd: CONFIG.geniki.password,
    applicationKey: CONFIG.geniki.appKey
  });

  const authResult = result[0].AuthenticateResult;
  
  if (authResult.Result !== 0) {
    throw new Error(`Authentication failed with code: ${authResult.Result}`);
  }

  // Cache for 23 hours
  authCache.key = authResult.Key;
  authCache.expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
  
  console.log('Authentication successful');
  return authResult.Key;
}

async function createVoucher(orderData) {
  const authKey = await authenticate();
  const client = await getGeinikiClient();

  // Build Geniki voucher record
  const voucher = {
    OrderId: orderData.order_number?.toString() || orderData.name,
    Name: `${orderData.shipping_address.first_name} ${orderData.shipping_address.last_name}`,
    Address: orderData.shipping_address.address1,
    City: orderData.shipping_address.city,
    Country: orderData.shipping_address.country_code || 'GR',
    Email: orderData.email || '',
    Telephone: orderData.shipping_address.phone || orderData.customer?.phone || '',
    Zip: orderData.shipping_address.zip || '',
    Weight: calculateWeight(orderData.line_items),
    Pieces: 1,
    Comments: (orderData.note || '').substring(0, 255),
    Services: determineServices(orderData),
    CodAmount: calculateCOD(orderData),
    InsAmount: 0,
    SubCode: '',
    ReceivedDate: new Date().toISOString().split('T')[0]
  };

  console.log('Creating voucher for order:', voucher.OrderId);

  const result = await client.CreateJobAsync({
    sAuthKey: authKey,
    oVoucher: voucher,
    eType: 'Voucher'
  });

  const createResult = result[0].CreateJobResult;
  
  if (createResult.Result !== 0) {
    throw new Error(`Voucher creation failed with code: ${createResult.Result}`);
  }

  console.log('Voucher created:', createResult.Voucher);

  return {
    jobId: createResult.JobId,
    voucherNumber: createResult.Voucher,
    subVouchers: createResult.SubVouchers || []
  };
}

async function getVoucherPdf(voucherNumber) {
  const authKey = await authenticate();
  const baseUrl = CONFIG.geniki.isTestMode ? 
    'https://testvoucher.taxydromiki.gr' : 
    'https://voucher.taxydromiki.gr';
  
  const url = `${baseUrl}/JobServicesV2.asmx/GetVoucherPdf?authKey=${authKey}&voucherNo=${voucherNumber}&format=Flyer&extraInfoFormat=None`;
  
  const response = await axios.get(url, { 
    responseType: 'arraybuffer',
    headers: { 'Accept': 'application/pdf' }
  });
  
  return response.data;
}

async function closePendingJobs() {
  const authKey = await authenticate();
  const client = await getGeinikiClient();

  console.log('Closing pending jobs...');
  const result = await client.ClosePendingJobsAsync({
    sAuthKey: authKey
  });

  const code = result[0];
  if (code !== 0) {
    throw new Error(`ClosePendingJobs failed with code: ${code}`);
  }

  console.log('Pending jobs closed successfully');
  return true;
}

async function closePendingJobsByDate(dateFrom, dateTo) {
  const authKey = await authenticate();
  const client = await getGeinikiClient();

  console.log('Closing pending jobs by date:', dateFrom, dateTo);
  const result = await client.ClosePendingJobsByDateAsync({
    sAuthKey: authKey,
    dFr: dateFrom,
    dTo: dateTo
  });

  // Handle different possible response formats
  let code;
  if (result && result[0] && typeof result[0] === 'object' && result[0].ClosePendingJobsByDateResult !== undefined) {
    code = result[0].ClosePendingJobsByDateResult;
  } else {
    code = result[0];
  }
  
  console.log('ClosePendingJobsByDate response:', result, 'Parsed code:', code);
  
  if (code !== 0) {
    throw new Error(`ClosePendingJobsByDate failed with code: ${code}`);
  }

  console.log('Pending jobs closed successfully');
  return true;
}

async function cancelJob(jobId) {
  const authKey = await authenticate();
  const client = await getGeinikiClient();

  console.log(`Canceling job ID: ${jobId}`);
  
  const result = await client.CancelJobAsync({
    sAuthKey: authKey,
    nJobId: parseInt(jobId),
    bCancel: true
  });

  // Handle different possible response formats
  let code;
  if (result && result[0] && typeof result[0] === 'object' && result[0].CancelJobResult !== undefined) {
    code = result[0].CancelJobResult;
  } else {
    code = result[0];
  }
  
  console.log('CancelJob response:', result, 'Parsed code:', code);
  
  if (code !== 0) {
    throw new Error(`CancelJob failed with code: ${code}`);
  }

  return true;
}

async function trackVoucher(voucherNumber, language = 'el') {
  const authKey = await authenticate();
  const client = await getGeinikiClient();

  const result = await client.TrackAndTraceAsync({
    authKey: authKey,
    voucherNo: voucherNumber,
    language: language
  });

  return result[0].TrackAndTraceResult;
}

// ==================== HELPER FUNCTIONS ====================

function calculateWeight(lineItems) {
  if (!lineItems || lineItems.length === 0) return 1; // Default 1kg
  
  const totalGrams = lineItems.reduce((sum, item) => {
    const grams = item.grams || 500; // Default 500g per item
    return sum + (grams * item.quantity);
  }, 0);
  
  return Math.max(0.1, (totalGrams / 1000)).toFixed(2); // Min 0.1kg
}

function determineServices(orderData) {
  const services = [];
  
  // Check for COD
  const isCOD = orderData.financial_status === 'pending' && 
    (orderData.payment_gateway_names?.some(gw => 
      gw.toLowerCase().includes('cash') || 
      gw.toLowerCase().includes('αντικαταβολ')
    ));
  
  if (isCOD) {
    services.push('αμ'); // COD with cash
  }
  
  // Check shipping method
  if (orderData.shipping_lines && orderData.shipping_lines.length > 0) {
    const shippingTitle = orderData.shipping_lines[0].title.toLowerCase();
    
    if (shippingTitle.includes('saturday') || shippingTitle.includes('σάββατο')) {
      services.push('5Σ');
    }
    if (shippingTitle.includes('express')) {
      services.push('ΤΝ');
    }
    if (shippingTitle.includes('morning') || shippingTitle.includes('πρωί')) {
      services.push('1Σ');
    }
  }
  
  return services.length > 0 ? services.join(',') : 'STD';
}

function calculateCOD(orderData) {
  const isCOD = orderData.financial_status === 'pending' && 
    (orderData.payment_gateway_names?.some(gw => 
      gw.toLowerCase().includes('cash') || 
      gw.toLowerCase().includes('αντικαταβολ')
    ));
  
  return isCOD ? parseFloat(orderData.total_price) : 0;
}

// ==================== SHOPIFY API FUNCTIONS ====================

async function shopifyAPI(endpoint, method = 'GET', data = null) {
  const url = `https://${CONFIG.shopify.shop}/admin/api/${CONFIG.shopify.apiVersion}/${endpoint}`;
  
  const options = {
    method,
    url,
    headers: {
      'X-Shopify-Access-Token': CONFIG.shopify.accessToken,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.data = data;
  }
  
  const response = await axios(options);
  return response.data;
}

async function getShopifyOrder(orderId) {
  return await shopifyAPI(`orders/${orderId}.json`);
}

async function updateShopifyFulfillment(orderId, trackingNumber) {
  // Get order to find fulfillment order id
  const orderData = await shopifyAPI(`orders/${orderId}.json`);
  const order = orderData.order;
  
  // Create fulfillment
  await shopifyAPI(`orders/${orderId}/fulfillments.json`, 'POST', {
    fulfillment: {
      location_id: order.location_id,
      tracking_number: trackingNumber,
      tracking_company: 'Geniki Taxydromiki',
      tracking_url: `https://www.taxydromiki.com/track/${trackingNumber}`,
      notify_customer: true
    }
  });
}

function verifyShopifyWebhook(req) {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const body = req.rawBody;
  
  const hash = crypto
    .createHmac('sha256', CONFIG.shopify.webhookSecret)
    .update(body, 'utf8')
    .digest('base64');
  
  return hash === hmac;
}

// ==================== DATABASE OPERATIONS ====================

// Database helper functions
async function insertOrder(orderData) {
  const query = `
    INSERT INTO orders (
      order_name, email, financial_status, fulfillment_status,
      first_name, last_name, shipping_address1, shipping_address2,
      shipping_city, shipping_province, shipping_zip, shipping_country,
      shipping_country_code, shipping_phone, total_price, payment_method,
      payment_status, outstanding_balance, line_items, products, notes, shopify_order_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
    ) ON CONFLICT (order_name) DO UPDATE SET
      email = EXCLUDED.email,
      financial_status = EXCLUDED.financial_status,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      shipping_address1 = EXCLUDED.shipping_address1,
      shipping_city = EXCLUDED.shipping_city,
      shipping_zip = EXCLUDED.shipping_zip,
      shipping_phone = EXCLUDED.shipping_phone,
      total_price = EXCLUDED.total_price,
      payment_status = EXCLUDED.payment_status,
      outstanding_balance = EXCLUDED.outstanding_balance,
      products = EXCLUDED.products,
      imported_at = CURRENT_TIMESTAMP
    RETURNING id`;
  
  const values = [
    orderData.orderName, orderData.email, orderData.financialStatus, orderData.fulfillmentStatus,
    orderData.firstName, orderData.lastName, orderData.address1, orderData.address2,
    orderData.city, orderData.province, orderData.zip, orderData.country,
    orderData.countryCode, orderData.phone, orderData.totalPrice, orderData.paymentMethod,
    orderData.paymentStatus, orderData.outstandingBalance, orderData.lineItems, JSON.stringify(orderData.products || []), orderData.note, orderData.orderId
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

async function getOrder(orderName) {
  const query = 'SELECT * FROM orders WHERE order_name = $1';
  const result = await pool.query(query, [orderName]);
  return result.rows[0];
}

async function getAllOrders(limit = 50) {
  const query = `
    SELECT o.*, 
           v.voucher_number, v.status as voucher_status, v.created_at as voucher_created_at
    FROM orders o 
    LEFT JOIN vouchers v ON o.id = v.order_id 
    ORDER BY o.created_at DESC 
    LIMIT $1`;
  const result = await pool.query(query, [limit]);
  return result.rows;
}

async function insertVoucher(orderName, voucherData) {
  const order = await getOrder(orderName);
  if (!order) throw new Error('Order not found');
  
  const query = `
    INSERT INTO vouchers (
      order_id, order_name, job_id, voucher_number, customer_name,
      shipping_address, phone, cod_amount, weight, services, geniki_response
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`;
  
  const customerName = `${order.first_name} ${order.last_name}`.trim();
  const shippingAddress = `${order.shipping_address1}, ${order.shipping_city} ${order.shipping_zip}`;
  
  const values = [
    order.id, orderName, voucherData.jobId, voucherData.voucherNumber,
    customerName, shippingAddress, order.shipping_phone, 
    parseFloat(order.total_price) || 0, 1.0, 'COD', JSON.stringify(voucherData)
  ];
  
  const result = await pool.query(query, values);
  
  // Mark order as processed
  await pool.query('UPDATE orders SET processed = TRUE WHERE order_name = $1', [orderName]);
  
  return result.rows[0];
}

async function recordCsvImport(filename, totalRows, successfulImports, failedImports, errors) {
  const query = `
    INSERT INTO csv_imports (filename, total_rows, successful_imports, failed_imports, errors)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id`;
  
  const values = [filename, totalRows, successfulImports, failedImports, JSON.stringify(errors)];
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

// ==================== CSV IMPORT & BULK PROCESSING ====================

// Upload and import CSV file with order data
app.post('/api/upload-csv', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const filePath = req.file.path;
    const filename = req.file.originalname;
    const results = [];
    const errors = [];

    // Parse CSV file
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let imported = 0;
        let failed = 0;

        try {
          // Group rows by order name to handle multiple line items per order
          const orderGroups = {};
          
          // First pass: group all rows by order name
          for (const row of results) {
            const orderName = row['Name'];
            if (orderName && orderName.startsWith('CLO#')) {
              if (!orderGroups[orderName]) {
                orderGroups[orderName] = [];
              }
              orderGroups[orderName].push(row);
            }
          }

          // Process each order group
          for (const [orderName, rows] of Object.entries(orderGroups)) {
            try {
              // Find the row with the most complete information (usually has shipping address)
              const primaryRow = rows.find(row => row['Shipping Name'] && row['Shipping Address1']) || rows[0];
              
              // Collect all line items from all rows for this order
              const products = [];
              let totalAmount = 0;
              
              for (const row of rows) {
                const itemName = row['Lineitem name'];
                const itemQuantity = parseInt(row['Lineitem quantity']) || 0;
                const itemPrice = parseFloat(row['Lineitem price']) || 0;
                
                if (itemName && itemQuantity > 0) {
                  // Check if this product already exists (same name)
                  const existingProduct = products.find(p => p.name === itemName);
                  if (existingProduct) {
                    existingProduct.quantity += itemQuantity;
                  } else {
                    products.push({
                      name: itemName,
                      quantity: itemQuantity,
                      price: itemPrice
                    });
                  }
                }
                
                // Use the total from the row with the highest total (most complete)
                const rowTotal = parseFloat(row['Total']) || 0;
                if (rowTotal > totalAmount) {
                  totalAmount = rowTotal;
                }
              }
              
              // Parse shipping name into first/last name
              const shippingName = primaryRow['Shipping Name'] || '';
              const nameParts = shippingName.split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              
              // Determine payment status based on Payment Method and Outstanding Balance
              const paymentMethod = primaryRow['Payment Method'] || 'custom';
              const outstandingBalance = parseFloat(primaryRow['Outstanding Balance']) || 0;
              let paymentStatus = 'cod'; // default
              
              if (paymentMethod === 'Shopify Payments' && outstandingBalance === 0) {
                paymentStatus = 'paid';
              } else if (paymentMethod === 'custom' && outstandingBalance > 0) {
                paymentStatus = 'cod';
              }
              
              const orderData = {
                orderId: orderName,
                orderName: orderName,
                firstName: firstName,
                lastName: lastName,
                address1: primaryRow['Shipping Address1'] || '',
                address2: primaryRow['Shipping Address2'] || '',
                city: primaryRow['Shipping City'] || '',
                province: primaryRow['Shipping Province'] || '',
                zip: primaryRow['Shipping Zip'] || '',
                country: primaryRow['Shipping Country'] || 'Greece',
                countryCode: primaryRow['Shipping Country Code'] || 'GR',
                phone: primaryRow['Shipping Phone'] || '',
                email: primaryRow['Email'] || '',
                totalPrice: totalAmount,
                financialStatus: primaryRow['Financial Status'] || 'pending',
                fulfillmentStatus: primaryRow['Fulfillment Status'] || '',
                paymentMethod: paymentMethod,
                paymentStatus: paymentStatus,
                outstandingBalance: outstandingBalance,
                note: primaryRow['Notes'] || '',
                lineItems: products.map(p => `${p.quantity}x ${p.name}`).join(', '),
                products: products // Store structured product data
              };
              
              await insertOrder(orderData);
              imported++;
              
            } catch (error) {
              failed++;
              errors.push(`Order ${orderName}: ${error.message}`);
            }
          }

          // Record import in database
          await recordCsvImport(filename, results.length, imported, failed, errors);

          // Clean up uploaded file
          fs.unlinkSync(filePath);

          res.json({
            success: true,
            message: `Successfully imported ${imported} orders from ${filename}`,
            imported: imported,
            failed: failed,
            total: Object.keys(orderGroups).length, // Total unique orders
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Show first 10 errors
          });

        } catch (error) {
          console.error('Database error during import:', error);
          res.status(500).json({
            success: false,
            error: 'Database error during import: ' + error.message
          });
        }
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        fs.unlinkSync(filePath); // Clean up
        res.status(500).json({
          success: false,
          error: 'CSV parsing error: ' + error.message
        });
      });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get imported orders from database
app.get('/api/imported-orders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const orders = await getAllOrders(limit);
    
            res.json({
              success: true,
              count: orders.length,
              orders: orders.map(order => ({
                orderId: order.order_name,
                orderName: order.order_name,
                firstName: order.first_name,
                lastName: order.last_name,
                address1: order.shipping_address1,
                address2: order.shipping_address2,
                city: order.shipping_city,
                zip: order.shipping_zip,
                phone: order.shipping_phone,
                email: order.email,
                totalPrice: order.total_price,
                financialStatus: order.financial_status,
                processed: order.processed,
                voucherNumber: order.voucher_number,
                voucherStatus: order.voucher_status,
                voucherCreated: order.voucher_created_at,
                importedAt: order.imported_at,
                lineItems: order.line_items,
                products: order.products ? (typeof order.products === 'string' ? JSON.parse(order.products) : order.products) : null,
                paymentStatus: order.payment_status,
                paymentMethod: order.payment_method,
                outstandingBalance: order.outstanding_balance
              }))
            });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific imported order
app.get('/api/imported-orders/:orderId', async (req, res) => {
  try {
    const orderData = await getOrder(req.params.orderId);
    
    if (!orderData) {
      return res.status(404).json({
        success: false,
        error: 'Order not found in database'
      });
    }
    
            res.json({
              success: true,
              order: {
                orderId: orderData.order_name,
                orderName: orderData.order_name,
                firstName: orderData.first_name,
                lastName: orderData.last_name,
                address1: orderData.shipping_address1,
                address2: orderData.shipping_address2,
                city: orderData.shipping_city,
                zip: orderData.shipping_zip,
                phone: orderData.shipping_phone,
                email: orderData.email,
                totalPrice: orderData.total_price,
                processed: orderData.processed,
                lineItems: orderData.line_items,
                products: orderData.products ? (typeof orderData.products === 'string' ? JSON.parse(orderData.products) : orderData.products) : null,
                paymentStatus: orderData.payment_status,
                paymentMethod: orderData.payment_method,
                outstandingBalance: orderData.outstanding_balance
              }
            });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create voucher using imported address data
app.post('/api/imported-orders/:orderId/voucher', async (req, res) => {
  try {
    const orderData = await getOrder(req.params.orderId);
    
    if (!orderData) {
      return res.status(404).json({
        success: false,
        error: 'Order not found in database'
      });
    }

    // Convert database order to Geniki format
    const geinikiOrder = {
      order_number: orderData.order_name,
      name: orderData.order_name,
      email: orderData.email,
      shipping_address: {
        first_name: orderData.first_name,
        last_name: orderData.last_name,
        address1: orderData.shipping_address1,
        address2: orderData.shipping_address2,
        city: orderData.shipping_city,
        zip: orderData.shipping_zip,
        country_code: orderData.shipping_country_code || 'GR',
        phone: orderData.shipping_phone
      },
      customer: {
        phone: orderData.shipping_phone
      },
      line_items: orderData.products ? JSON.parse(orderData.products) : [],
      total_price: orderData.total_price,
      note: orderData.notes || ''
    };

    // Create voucher with Geniki
    const voucher = await createVoucher(geinikiOrder);
    
    // Save voucher to database
    const savedVoucher = await insertVoucher(orderData.order_name, voucher);
    
    res.json({
      success: true,
      message: `Voucher created successfully for ${orderData.order_name}`,
      voucher: {
        jobId: voucher.jobId,
        voucherNumber: voucher.voucherNumber,
        downloadUrl: `/api/voucher/${voucher.voucherNumber}/pdf`
      }
    });

  } catch (error) {
    console.error('Error creating voucher for imported order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
