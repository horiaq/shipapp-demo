const express = require('express');
const soap = require('soap');
const axios = require('axios');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// PostgreSQL configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'geniki_orders',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

// Multer configuration for file uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files allowed'), false);
    }
  }
});

// Configuration
const CONFIG = {
  geniki: {
    wsdlUrl: process.env.GENIKI_WSDL || 'http://testservices.taxydromiki.com/customerwebservice/service.asmx?WSDL',
    username: process.env.GENIKI_USERNAME || 'clotest',
    password: process.env.GENIKI_PASSWORD || '700149@',
    appKey: process.env.GENIKI_APPKEY || 'D8E50F4B-E372-4CFC-8330-EEF2B8D6D478'
  },
  shopify: {
    shop: process.env.SHOPIFY_SHOP || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
    apiVersion: '2025-01'
  }
};

// Database connection events
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('❌ Database connection test failed:', err);
  } else {
    console.log('✅ Database connection test successful');
  }
});

// Geniki SOAP client cache
let geinikiClient = null;

async function getGeinikiClient() {
  if (!geinikiClient) {
    geinikiClient = await soap.createClientAsync(CONFIG.geniki.wsdlUrl);
  }
  return geinikiClient;
}

// ==================== GENIKI API FUNCTIONS ====================

async function authenticate() {
  const client = await getGeinikiClient();
  
  const authResult = await client.AuthenticateUserAsync({
    sUsername: CONFIG.geniki.username,
    sPassword: CONFIG.geniki.password,
    sApplicationKey: CONFIG.geniki.appKey
  });

  const result = authResult[0];
  if (result.AuthenticateUserResult.Result !== 0) {
    throw new Error(`Authentication failed: ${result.AuthenticateUserResult.Message}`);
  }
  
  console.log('Authentication successful');
  return authResult[0].AuthenticateUserResult.Key;
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
  const client = await getGeinikiClient();

  const result = await client.GetVouchersPdfAsync({
    sAuthKey: authKey,
    sVouchers: voucherNumber
  });

  return Buffer.from(result[0].GetVouchersPdfResult, 'base64');
}

async function cancelJob(jobId) {
  const authKey = await authenticate();
  const client = await getGeinikiClient();

  const result = await client.CancelJobAsync({
    sAuthKey: authKey,
    iJobId: jobId
  });

  const cancelResult = result[0].CancelJobResult;
  if (cancelResult !== 0) {
    throw new Error(`Job cancellation failed with code: ${cancelResult}`);
  }

  console.log('Job cancelled successfully:', jobId);
  return true;
}

async function closePendingJobs() {
  const authKey = await authenticate();
  const client = await getGeinikiClient();

  const result = await client.ClosePendingJobsAsync({
    sAuthKey: authKey
  });

  console.log('All pending jobs closed');
  return result[0].ClosePendingJobsResult;
}

async function closePendingJobsByDate(dateFrom, dateTo) {
  const authKey = await authenticate();
  const client = await getGeinikiClient();

  const result = await client.ClosePendingJobsByDateAsync({
    sAuthKey: authKey,
    dDateFrom: dateFrom,
    dDateTo: dateTo
  });

  const closeResult = result[0].ClosePendingJobsByDateResult;
  if (closeResult !== 0) {
    throw new Error(`Close pending jobs failed with code: ${closeResult}`);
  }

  console.log(`Pending jobs closed for period: ${dateFrom} to ${dateTo}`);
  return true;
}

// Helper functions
function calculateWeight(lineItems) {
  if (!lineItems || lineItems.length === 0) return 500;
  return lineItems.reduce((total, item) => total + (item.grams * item.quantity), 0);
}

function determineServices(orderData) {
  const services = [];
  
  if (orderData.financial_status === 'pending' || 
      (orderData.payment_gateway_names && orderData.payment_gateway_names.includes('COD'))) {
    services.push('COD');
  }
  
  return services.join(',');
}

function calculateCOD(orderData) {
  if (orderData.financial_status === 'pending' || 
      (orderData.payment_gateway_names && orderData.payment_gateway_names.includes('COD'))) {
    return parseFloat(orderData.total_price) || 0;
  }
  return 0;
}

// ==================== SHOPIFY FUNCTIONS ====================

async function makeShopifyRequest(endpoint, method = 'GET', data = null) {
  const url = `https://${CONFIG.shopify.shop}/admin/api/${CONFIG.shopify.apiVersion}${endpoint}`;
  
  const config = {
    method,
    url,
    headers: {
      'X-Shopify-Access-Token': CONFIG.shopify.accessToken,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Shopify API Error (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
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
    SELECT * FROM orders 
    ORDER BY imported_at DESC 
    LIMIT $1`;
  const result = await pool.query(query, [limit]);
  return result.rows;
}

async function insertVoucher(orderName, voucherData) {
  const query = `
    INSERT INTO vouchers (order_name, voucher_number, job_id, pdf_path, created_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    RETURNING id`;
  
  const values = [orderName, voucherData.voucherNumber, voucherData.jobId, null];
  const result = await pool.query(query, values);
  
  // Also update the orders table
  const updateQuery = `
    UPDATE orders 
    SET processed = TRUE, voucher_number = $1, voucher_status = 'created', voucher_created_at = CURRENT_TIMESTAMP
    WHERE order_name = $2`;
  await pool.query(updateQuery, [voucherData.voucherNumber, orderName]);
  
  return result.rows[0];
}

async function recordCsvImport(filename, totalRows, imported, failed, errors) {
  const query = `
    INSERT INTO csv_imports (filename, total_rows, imported_count, failed_count, errors, imported_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING id`;
  
  const values = [filename, totalRows, imported, failed, JSON.stringify(errors)];
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: process.env.NODE_ENV || 'development',
    database: 'connected',
    geniki: 'ready'
  });
});

// Get Shopify orders (with address data)
app.get('/api/orders', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const data = await makeShopifyRequest(`/orders.json?limit=${limit}&status=any`);
    
    res.json({
      success: true,
      count: data.orders.length,
      orders: data.orders.map(order => ({
        id: order.id,
        name: order.name,
        email: order.email,
        total_price: order.total_price,
        financial_status: order.financial_status,
        fulfillment_status: order.fulfillment_status,
        created_at: order.created_at,
        shipping_address: order.shipping_address,
        billing_address: order.billing_address,
        customer: order.customer,
        line_items: order.line_items?.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }))
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

// Test Shopify connection
app.get('/api/shopify-test', async (req, res) => {
  try {
    const shopData = await makeShopifyRequest('/shop.json');
    const ordersData = await makeShopifyRequest('/orders.json?limit=5');
    
    res.json({
      success: true,
      shop: {
        name: shopData.shop.name,
        domain: shopData.shop.domain,
        plan: shopData.shop.plan_name
      },
      orders: {
        count: ordersData.orders.length,
        sample: ordersData.orders[0] || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create voucher for Shopify order
app.post('/api/orders/:orderId/voucher', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get order from Shopify
    const orderData = await makeShopifyRequest(`/orders/${orderId}.json`);
    const order = orderData.order;
    
    if (!order.shipping_address) {
      return res.status(400).json({
        success: false,
        error: 'Order has no shipping address'
      });
    }

    // Create voucher with Geniki
    const voucher = await createVoucher(order);
    
    res.json({
      success: true,
      message: `Voucher created for order ${order.name}`,
      order: {
        id: order.id,
        name: order.name,
        customer: `${order.shipping_address.first_name} ${order.shipping_address.last_name}`,
        address: `${order.shipping_address.address1}, ${order.shipping_address.city} ${order.shipping_address.zip}`
      },
      voucher: {
        jobId: voucher.jobId,
        voucherNumber: voucher.voucherNumber,
        subVouchers: voucher.subVouchers,
        downloadUrl: `/api/voucher/${voucher.voucherNumber}/pdf`
      }
    });

  } catch (error) {
    console.error('Error creating voucher:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload CSV file and import orders
app.post('/api/upload-csv', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const filePath = req.file.path;
    const filename = req.file.originalname;
    const results = [];
    const errors = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let imported = 0;
        let failed = 0;

        try {
          const orderGroups = {};
          for (const row of results) {
            const orderName = row['Name'];
            if (orderName && orderName.startsWith('CLO#')) {
              if (!orderGroups[orderName]) {
                orderGroups[orderName] = [];
              }
              orderGroups[orderName].push(row);
            }
          }

          for (const [orderName, rows] of Object.entries(orderGroups)) {
            try {
              const primaryRow = rows.find(row => row['Shipping Name'] && row['Shipping Address1']) || rows[0];
              
              const products = [];
              let totalAmount = 0;
              
              for (const row of rows) {
                const itemName = row['Lineitem name'];
                const itemQuantity = parseInt(row['Lineitem quantity']) || 0;
                const itemPrice = parseFloat(row['Lineitem price']) || 0;
                
                if (itemName && itemQuantity > 0) {
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
                
                const rowTotal = parseFloat(row['Total']) || 0;
                if (rowTotal > totalAmount) {
                  totalAmount = rowTotal;
                }
              }
              
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

          await recordCsvImport(filename, results.length, imported, failed, errors);
          fs.unlinkSync(filePath);
          res.json({
            success: true,
            message: `Successfully imported ${imported} orders from ${filename}`,
            imported: imported,
            failed: failed,
            total: Object.keys(orderGroups).length,
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined
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
        fs.unlinkSync(filePath);
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
      line_items: orderData.products ? (typeof orderData.products === 'string' ? JSON.parse(orderData.products) : orderData.products) : [],
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

// Test all Geniki API methods (for production credentials)
app.get('/api/test-all-geniki-methods', async (req, res) => {
  try {
    console.log('🧪 Testing ALL Geniki API methods for production readiness...');
    
    const results = {};
    
    // Test 1: Authentication
    console.log('1️⃣ Testing AUTHENTICATE...');
    const authKey = await authenticate();
    results.authenticate = {
      success: true,
      authKey: authKey.substring(0, 20) + '...',
      message: 'Authentication successful'
    };
    
    // Test 2: Create voucher
    console.log('2️⃣ Testing CREATEJOB...');
    const testOrder = {
      order_number: 'TEST-' + Date.now(),
      name: 'TEST-ORDER',
      shipping_address: {
        first_name: 'Test',
        last_name: 'Customer',
        address1: 'Patision 123',
        city: 'Athens',
        zip: '10434',
        country_code: 'GR',
        phone: '2101234567'
      },
      email: 'test@test.gr',
      total_price: 25.00,
      line_items: [{ grams: 500, quantity: 1, name: 'Test Product' }]
    };
    
    const voucher = await createVoucher(testOrder);
    results.createJob = {
      success: true,
      jobId: voucher.jobId,
      voucherNumber: voucher.voucherNumber,
      message: 'Voucher created successfully'
    };
    
    // Test 3: Get PDF
    console.log('3️⃣ Testing GETVOUCHERSPDF...');
    const pdf = await getVoucherPdf(voucher.voucherNumber);
    results.getVouchersPdf = {
      success: true,
      pdfSize: pdf.length + ' bytes',
      message: 'PDF generated successfully'
    };
    
    // Test 4: Cancel job
    console.log('4️⃣ Testing CANCELJOB...');
    await cancelJob(voucher.jobId);
    results.cancelJob = {
      success: true,
      message: 'Job cancelled successfully'
    };
    
    // Test 5: Close pending jobs
    console.log('5️⃣ Testing CLOSEPENDINGJOBS...');
    const today = new Date().toISOString().split('T')[0];
    await closePendingJobsByDate(today, today);
    results.closePendingJobs = {
      success: true, 
      date: today,
      message: 'Pending jobs closed successfully'
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
      error: error.message
    });
  }
});

// Generate production demo label for Geniki
app.get('/api/demo-label', async (req, res) => {
  try {
    console.log('🎯 Creating production demo label for Geniki approval...');
    
    // Demo order with real Greek address format
    const demoOrder = {
      order_number: 'CLO#DEMO-' + Date.now(),
      name: 'CLO#DEMO-ORDER',
      shipping_address: {
        first_name: 'Γιάννης',
        last_name: 'Παπαδόπουλος', 
        address1: 'Πατησίων 123',
        address2: '',
        city: 'Αθήνα',
        zip: '10434',
        country_code: 'GR',
        phone: '6912345678'
      },
      email: 'demo@closkin.gr',
      total_price: 47.90,
      financial_status: 'pending',
      payment_gateway_names: ['COD'],
      note: 'Demo order για production approval - Geniki API Integration Test',
      line_items: [
        { grams: 800, quantity: 2, name: 'Dream Towels XL' },
        { grams: 300, quantity: 1, name: 'Dream Towels Mini' }
      ]
    };

    // Create actual voucher
    const voucher = await createVoucher(demoOrder);
    
    // Get PDF for verification
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

// Bulk create vouchers for multiple imported orders
app.post('/api/bulk-vouchers-from-csv', async (req, res) => {
  try {
    const { orderIds, limit = 20 } = req.body;
    
    let ordersToProcess;
    if (orderIds && Array.isArray(orderIds)) {
      ordersToProcess = [];
      for (const orderId of orderIds) {
        const order = await getOrder(orderId);
        if (order && !order.processed) {
          ordersToProcess.push(order);
        }
      }
    } else {
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
        await insertVoucher(orderData.order_name, voucher);
        
        results.push({
          orderId: orderData.order_name,
          success: true,
          voucherNumber: voucher.voucherNumber
        });
        
        successCount++;
      } catch (error) {
        console.error(`Error creating voucher for ${orderData.order_name}:`, error);
        results.push({
          orderId: orderData.order_name,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Error in bulk voucher creation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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
    res.status(500).json({ error: error.message });
  }
});

// ==================== SERVER STARTUP ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Mode: ${process.env.NODE_ENV || 'development'}`);
  if (CONFIG.shopify?.shop) {
    console.log(`🏪 Shop: ${CONFIG.shopify.shop}`);
  }
  console.log(`🗄️  Database: ${pool.options.database} on ${pool.options.host}:${pool.options.port}`);
});


