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

// Bulk create vouchers for imported orders from CSV
app.post('/api/bulk-vouchers-from-csv', async (req, res) => {
        country_code: orderData.shipping_country_code,
        phone: orderData.shipping_phone
      },
      email: orderData.email,
      total_price: orderData.total_price,
      financial_status: orderData.financial_status,
      payment_gateway_names: [orderData.payment_method],
      note: orderData.notes,
      line_items: [{ 
        grams: 500, // Default weight - can be improved with product data
        quantity: 1,
        name: orderData.line_items
      }]
    };
    
    const voucher = await createVoucher(geinikiOrder);
    
    // Save voucher to database
    const savedVoucher = await insertVoucher(orderData.order_name, voucher);
    
    res.json({
      success: true,
      message: 'Voucher created and saved to database',
      orderData: {
        orderId: orderData.order_name,
        customer: `${orderData.first_name} ${orderData.last_name}`,
        address: `${orderData.shipping_address1}, ${orderData.shipping_city} ${orderData.shipping_zip}`
      },
      voucher: {
        id: savedVoucher.id,
        voucherNumber: voucher.voucherNumber,
        jobId: voucher.jobId
      },
      ...voucher
    });
    
  } catch (error) {
    console.error('Error creating voucher from imported data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk create vouchers for multiple imported orders
app.post('/api/bulk-vouchers-from-csv', async (req, res) => {
  try {
    const { orderIds, limit = 20 } = req.body;
    
    let ordersToProcess;
    if (orderIds && Array.isArray(orderIds)) {
      // Process specific order IDs
      ordersToProcess = [];
      for (const orderId of orderIds) {
        const order = await getOrder(orderId);
        if (order && !order.processed) {
          ordersToProcess.push(order);
        }
      }
    } else {
      // Process all unprocessed orders (limited)
      const query = `
        SELECT * FROM orders 
        WHERE processed = FALSE 
        ORDER BY created_at ASC 
        LIMIT $1`;
      const result = await pool.query(query, [limit]);
      ordersToProcess = result.rows;
    }
    
    const results = [];
    let successCount = 0;
    
    for (const orderData of ordersToProcess) {
      try {
        const geinikiOrder = {
          order_number: orderData.order_name,
          name: orderData.order_name,
          shipping_address: {
            first_name: orderData.first_name,
            last_name: orderData.last_name,
            address1: orderData.shipping_address1,
            city: orderData.shipping_city,
            zip: orderData.shipping_zip,
            country_code: orderData.shipping_country_code,
            phone: orderData.shipping_phone
          },
          email: orderData.email,
          total_price: orderData.total_price,
          financial_status: orderData.financial_status,
          payment_gateway_names: [orderData.payment_method],
          note: orderData.notes,
          line_items: [{ grams: 500, quantity: 1, name: orderData.line_items }]
        };
        
        const voucher = await createVoucher(geinikiOrder);
        
        // Save voucher to database
        const savedVoucher = await insertVoucher(orderData.order_name, voucher);
        
        results.push({
          orderId: orderData.order_name,
          orderName: orderData.order_name,
          customer: `${orderData.first_name} ${orderData.last_name}`,
          success: true,
          voucherNumber: voucher.voucherNumber,
          jobId: voucher.jobId,
          voucherId: savedVoucher.id
        });
        
        successCount++;
        
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error processing order ${orderData.order_name}:`, error);
        results.push({
          orderId: orderData.order_name,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Bulk voucher creation completed: ${successCount}/${ordersToProcess.length} successful`,
      processed: ordersToProcess.length,
      successful: successCount,
      failed: ordersToProcess.length - successCount,
      results: results
    });
    
  } catch (error) {
    console.error('Bulk voucher creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== API ENDPOINTS ====================

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await authenticate();
    res.json({ 
      status: 'ok', 
      geniki: 'connected',
      mode: CONFIG.geniki.isTestMode ? 'test' : 'production'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Shopify connection diagnostic
app.get('/api/shopify-test', async (req, res) => {
  try {
    // Test basic shop info
    const shopInfo = await shopifyAPI('shop.json');
    
    // Test orders access
    let ordersTest = null;
    try {
      const orders = await shopifyAPI('orders.json?limit=1');
      ordersTest = { success: true, count: orders.orders.length };
    } catch (error) {
      ordersTest = { success: false, error: error.message };
    }
    
    res.json({
      status: 'success',
      shopify: {
        connected: true,
        shop: shopInfo.shop.name,
        domain: shopInfo.shop.domain,
        apiVersion: CONFIG.shopify.apiVersion
      },
      ordersAccess: ordersTest,
      config: {
        hasAccessToken: !!CONFIG.shopify.accessToken,
        tokenType: CONFIG.shopify.accessToken ? CONFIG.shopify.accessToken.substring(0, 6) + '...' : 'missing'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      config: {
        hasShop: !!CONFIG.shopify.shop,
        hasAccessToken: !!CONFIG.shopify.accessToken,
        tokenType: CONFIG.shopify.accessToken ? CONFIG.shopify.accessToken.substring(0, 6) + '...' : 'missing'
      }
    });
  }
});

// Get pending orders
app.get('/api/orders', async (req, res) => {
  try {
    const result = await shopifyAPI('orders.json?status=any&fulfillment_status=unfulfilled');
    res.json(result.orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test all required Geniki methods for production credentials
app.post('/api/test-all-geniki-methods', async (req, res) => {
  const results = {};
  
  try {
    // 1. AUTHENTICATE
    console.log('Testing AUTHENTICATE...');
    const authKey = await authenticate();
    results.authenticate = { success: true, hasKey: !!authKey };
    
    // 2. CREATEJOB
    console.log('Testing CREATEJOB...');
    const sampleOrder = {
      order_number: 'PROD_TEST_' + Date.now(),
      name: 'PROD_TEST#' + Date.now() + 'GR',
      shipping_address: {
        first_name: 'Γιάννης',
        last_name: 'Παπαδόπουλος', 
        address1: 'Ερμού 45',
        city: 'Αθήνα',
        zip: '10563',
        phone: '6912345678',
        country_code: 'GR'
      },
      email: 'test@closkin.gr',
      line_items: [{ grams: 500, quantity: 1 }],
      total_price: '25.50',
      financial_status: 'pending',
      payment_gateway_names: ['Αντικαταβολή'],
      note: 'Production credentials test'
    };
    
    const voucher = await createVoucher(sampleOrder);
    results.createJob = { 
      success: true, 
      jobId: voucher.jobId,
      voucherNumber: voucher.voucherNumber 
    };
    
    // 3. GETVOUCHERSPDF
    console.log('Testing GETVOUCHERSPDF...');
    const pdfBuffer = await getVoucherPdf(voucher.voucherNumber);
    results.getVouchersPdf = { 
      success: true, 
      pdfSize: pdfBuffer.length,
      voucherNumber: voucher.voucherNumber
    };
    
    // 4. CANCELJOB (we'll create another job to cancel)
    console.log('Testing CANCELJOB...');
    const cancelTestOrder = {
      ...sampleOrder,
      order_number: 'CANCEL_TEST_' + Date.now(),
      name: 'CANCEL_TEST#' + Date.now() + 'GR'
    };
    const cancelVoucher = await createVoucher(cancelTestOrder);
    await cancelJob(cancelVoucher.jobId);
    results.cancelJob = { 
      success: true, 
      cancelledJobId: cancelVoucher.jobId,
      cancelledVoucherNumber: cancelVoucher.voucherNumber
    };
    
    // 5. CLOSEPENDINGJOBS (we'll close pending jobs from today)
    console.log('Testing CLOSEPENDINGJOBS...');
    const today = new Date().toISOString().split('T')[0];
    await closePendingJobsByDate(today, today);
    results.closePendingJobs = { 
      success: true, 
      date: today
    };
    
    res.json({
      success: true,
      message: '🎉 ALL GENIKI API METHODS TESTED SUCCESSFULLY!',
      note: 'Ready for production credentials',
      testResults: results,
      summary: {
        authenticate: '✅ PASSED',
        createJob: '✅ PASSED', 
        getVouchersPdf: '✅ PASSED',
        cancelJob: '✅ PASSED',
        closePendingJobs: '✅ PASSED'
      }
    });
    
  } catch (error) {
    console.error('Error in Geniki methods test:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      completedTests: results
    });
  }
});

// Generate production demo label for Geniki
app.post('/api/demo-label', async (req, res) => {
  try {
    // Realistic Greek order data for production demo
    const demoOrder = {
      order_number: 'DEMO_' + Date.now(),
      name: 'DEMO#' + Date.now() + 'GR',
      shipping_address: {
        first_name: 'Μαρία',
        last_name: 'Κωνσταντινίδου', 
        address1: 'Βασιλίσσης Σοφίας 115',
        city: 'Αθήνα',
        zip: '11521',
        phone: '6987654321',
        country_code: 'GR'
      },
      email: 'maria.konstantinidou@closkin.gr',
      line_items: [{ grams: 800, quantity: 2 }], // 2 items, 800g each
      total_price: '47.90',
      financial_status: 'pending', 
      payment_gateway_names: ['Αντικαταβολή'], // COD
      note: 'Παραγγελία προϊόντων περιποίησης δέρματος - Production Demo για Geniki Taxydromiki'
    };
    
    console.log('🏷️ Creating production demo label...');
    const voucher = await createVoucher(demoOrder);
    
    console.log('📄 Downloading label PDF...');
    const pdfBuffer = await getVoucherPdf(voucher.voucherNumber);
    
    res.json({ 
      success: true, 
      message: '🎉 Production demo label created successfully!',
      demo: {
        purpose: 'Proof of successful Geniki API integration',
        customer: `${demoOrder.shipping_address.first_name} ${demoOrder.shipping_address.last_name}`,
        address: `${demoOrder.shipping_address.address1}, ${demoOrder.shipping_address.city} ${demoOrder.shipping_address.zip}`,
        phone: demoOrder.shipping_address.phone,
        email: demoOrder.email,
        weight: '1.6 kg',
        codAmount: '47.90 EUR',
        services: 'COD (Αντικαταβολή)'
      },
      voucher: {
        jobId: voucher.jobId,
        voucherNumber: voucher.voucherNumber,
        pdfSize: pdfBuffer.length + ' bytes',
        downloadUrl: `/api/voucher/${voucher.voucherNumber}/pdf`
      },
      instructions: {
        step1: 'Download the PDF label using the downloadUrl',
        step2: 'Send this voucher number to Geniki as proof: ' + voucher.voucherNumber,
        step3: 'Show them this complete working integration'
      }
    });
  } catch (error) {
    console.error('Error creating demo label:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Test voucher with sample data
app.post('/api/test-voucher', async (req, res) => {
  try {
    // Sample Greek order data for testing
    const sampleOrder = {
      order_number: 'TEST123',
      name: 'TEST#123GR',
      shipping_address: {
        first_name: 'Γιάννης',
        last_name: 'Παπαδόπουλος', 
        address1: 'Ερμού 45',
        city: 'Αθήνα',
        zip: '10563',
        phone: '6912345678',
        country_code: 'GR'
      },
      email: 'test@example.com',
      line_items: [{ grams: 500, quantity: 1 }],
      total_price: '25.50',
      financial_status: 'pending',
      payment_gateway_names: ['Αντικαταβολή'],
      note: 'Test order for Geniki integration'
    };
    
    const voucher = await createVoucher(sampleOrder);
    
    res.json({ 
      success: true, 
      message: 'Test voucher created successfully!',
      sampleData: sampleOrder.shipping_address,
      ...voucher 
    });
  } catch (error) {
    console.error('Error creating test voucher:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create voucher for single order
app.post('/api/orders/:orderId/voucher', async (req, res) => {
  try {
    const orderData = await getShopifyOrder(req.params.orderId);
    const voucher = await createVoucher(orderData.order);
    
    // Update Shopify with tracking
    await updateShopifyFulfillment(req.params.orderId, voucher.voucherNumber);
    
    res.json({ 
      success: true, 
      ...voucher 
    });
  } catch (error) {
    console.error('Error creating voucher:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create vouchers for multiple orders
app.post('/api/orders/bulk-voucher', async (req, res) => {
  const { orderIds } = req.body;
  
  const results = [];
  
  for (const orderId of orderIds) {
    try {
      const orderData = await getShopifyOrder(orderId);
      const voucher = await createVoucher(orderData.order);
      await updateShopifyFulfillment(orderId, voucher.voucherNumber);
      
      results.push({ orderId, success: true, ...voucher });
    } catch (error) {
      results.push({ orderId, success: false, error: error.message });
    }
  }
  
  res.json({ results });
});

// Download label PDF
app.get('/api/voucher/:voucherNumber/pdf', async (req, res) => {
  try {
    const pdf = await getVoucherPdf(req.params.voucherNumber);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=label-${req.params.voucherNumber}.pdf`);
    res.send(pdf);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Finalize vouchers
app.post('/api/vouchers/finalize', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body;
    
    if (dateFrom && dateTo) {
      await closePendingJobsByDate(dateFrom, dateTo);
    } else {
      await closePendingJobs();
    }
    
    res.json({ success: true, message: 'Vouchers finalized' });
  } catch (error) {
    console.error('Error finalizing vouchers:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Track voucher
app.get('/api/voucher/:voucherNumber/track', async (req, res) => {
  try {
    const tracking = await trackVoucher(req.params.voucherNumber, req.query.lang || 'el');
    res.json(tracking);
  } catch (error) {
    console.error('Error tracking voucher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel job
app.post('/api/job/:jobId/cancel', async (req, res) => {
  try {
    await cancelJob(req.params.jobId);
    res.json({ success: true, message: 'Job canceled' });
  } catch (error) {
    console.error('Error canceling job:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== SHOPIFY WEBHOOKS ====================

// Middleware to capture raw body for webhook verification
app.use('/webhooks/*', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body.toString('utf8');
  req.body = JSON.parse(req.rawBody);
  next();
});

// Webhook: Order created (auto-create voucher)
app.post('/webhooks/orders/create', async (req, res) => {
  // Verify webhook
  if (CONFIG.shopify.webhookSecret && !verifyShopifyWebhook(req)) {
    return res.status(401).send('Webhook verification failed');
  }
  
  const order = req.body;
  
  console.log(`Webhook: New order #${order.order_number}`);
  
  try {
    // Only create voucher if order is paid or COD
    if (order.financial_status === 'paid' || 
        order.payment_gateway_names?.some(gw => gw.toLowerCase().includes('cash'))) {
      
      const voucher = await createVoucher(order);
      await updateShopifyFulfillment(order.id, voucher.voucherNumber);
      
      console.log(`Auto-created voucher ${voucher.voucherNumber} for order #${order.order_number}`);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   Geniki Taxydromiki - Shopify App         ║
╚════════════════════════════════════════════╝

🚀 Server running on port ${PORT}
📦 Mode: ${CONFIG.geniki.isTestMode ? 'TEST' : 'PRODUCTION'}
🏪 Shop: ${CONFIG.shopify.shop || 'Not configured'}

Endpoints:
- GET  /api/health              - Check status
- GET  /api/orders              - List orders
- POST /api/orders/:id/voucher  - Create voucher
- POST /api/orders/bulk-voucher - Bulk create
- GET  /api/voucher/:no/pdf     - Download label
- POST /api/vouchers/finalize   - Finalize all
- GET  /api/voucher/:no/track   - Track shipment

Webhooks:
- POST /webhooks/orders/create  - Auto-create voucher
  `);
});