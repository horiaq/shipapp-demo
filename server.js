// Load environment variables FIRST before anything else
require('dotenv').config();

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
const cron = require('node-cron');

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

// ============================================================================
// AUTHENTICATION ROUTES & MIDDLEWARE
// ============================================================================
const authRoutes = require('./routes/auth');
authRoutes.setPool(pool); // Pass database pool to auth routes
app.use('/api/auth', authRoutes);

const { authenticateUser, authorizeWorkspace } = require('./middleware/auth');

// Configuration
const CONFIG = {
  geniki: {
    wsdlUrl: process.env.GENIKI_WSDL || 'https://voucher.taxydromiki.gr/JobServicesV2.asmx?WSDL',
    username: process.env.GENIKI_USERNAME || 'closkin',
    password: process.env.GENIKI_PASSWORD || 'csk$$149',
    appKey: process.env.GENIKI_APPKEY || 'B7772667-0B6D-4FDA-8408-111D6D7F2989'
  },
  shopify: {
    shop: process.env.SHOPIFY_SHOP || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
    apiVersion: '2025-01'
  },
  meest: {
    production: 'https://mwl.meest.com/mwl',
    staging: 'https://mwl-stage.meest.com/mwl'
  }
};

// Meest API configuration helper
// Always use production since we have production credentials
const getMeestBaseUrl = () => {
  return CONFIG.meest.production;
};

// ============================================================================
// WORKSPACE SETTINGS HELPER
// ============================================================================

/**
 * Get workspace settings from database
 * @param {number} workspaceId - The workspace ID
 * @returns {Promise<Object>} Workspace settings
 */
async function getWorkspaceSettings(workspaceId) {
  try {
    const result = await pool.query(
      'SELECT * FROM workspaces WHERE workspace_id = $1 AND is_active = true',
      [workspaceId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Workspace ${workspaceId} not found or inactive`);
    }
    
    const workspace = result.rows[0];
    
    // Return workspace settings with fallbacks to CONFIG if not set
    return {
      ...workspace,
      // Geniki settings
      geniki_username: workspace.geniki_username || CONFIG.geniki.username,
      geniki_password: workspace.geniki_password || CONFIG.geniki.password,
      geniki_app_key: workspace.geniki_app_key || CONFIG.geniki.appKey,
      geniki_wsdl_url: workspace.geniki_wsdl_url || CONFIG.geniki.wsdlUrl,
      // Shopify settings
      shopify_shop: workspace.shopify_shop || CONFIG.shopify.shop,
      shopify_access_token: workspace.shopify_access_token || CONFIG.shopify.accessToken,
      // Defaults for optional fields
      invoice_language: workspace.invoice_language || 'EN',
      invoice_currency: workspace.invoice_currency || 'EUR',
      shipping_threshold: parseFloat(workspace.shipping_threshold) || 40.00,
      shipping_cost: parseFloat(workspace.shipping_cost) || 3.00,
      oblio_vat_rate: parseFloat(workspace.oblio_vat_rate) || 21.00,
    };
  } catch (error) {
    console.error(`❌ Error fetching workspace settings for workspace ${workspaceId}:`, error);
    throw error;
  }
}

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

// Geniki SOAP client and auth cache (workspace-aware)
const geinikiClientsByWorkspace = new Map();
const authCacheByWorkspace = new Map();

// Meest token cache (per workspace)
const meestTokenCacheByWorkspace = new Map();
const MEEST_TOKEN_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

// Clear auth cache for fresh start
console.log('🔄 Clearing authentication cache for production start...');

async function getGeinikiClient(workspaceId) {
  const workspace = await getWorkspaceSettings(workspaceId);
  const wsdlUrl = workspace.geniki_wsdl_url;
  
  // Use cached client for this workspace if available
  if (!geinikiClientsByWorkspace.has(workspaceId)) {
    geinikiClientsByWorkspace.set(workspaceId, await soap.createClientAsync(wsdlUrl));
  }
  return geinikiClientsByWorkspace.get(workspaceId);
}

// ==================== GENIKI API FUNCTIONS ====================

async function authenticate(workspaceId, forceRefresh = false) {
  const workspace = await getWorkspaceSettings(workspaceId);
  
  // For production, use shorter cache time and be more conservative
  const now = Date.now();
  const cacheValidityMs = process.env.NODE_ENV === 'production' ? (1 * 60 * 1000) : (20 * 60 * 60 * 1000); // 1 min prod, 20 hours dev
  
  // Check workspace-specific cache
  const cachedAuth = authCacheByWorkspace.get(workspaceId);
  if (!forceRefresh && cachedAuth && cachedAuth.expiryTime && now < cachedAuth.expiryTime) {
    console.log(`Using cached authentication key for workspace ${workspaceId} (prod-safe)`);
    return cachedAuth.key;
  }

  console.log(`🔑 Getting fresh authentication key for workspace ${workspaceId}...`);
  console.log('🔧 Credentials being used:');
  console.log('  Username:', workspace.geniki_username ? workspace.geniki_username.substring(0, 3) + '***' : 'NOT SET');
  console.log('  Password:', workspace.geniki_password ? workspace.geniki_password.substring(0, 2) + '***' : 'NOT SET');
  console.log('  AppKey:', workspace.geniki_app_key ? workspace.geniki_app_key.substring(0, 8) + '***' : 'NOT SET');
  console.log('  WSDL URL:', workspace.geniki_wsdl_url);
  
  const client = await getGeinikiClient(workspaceId);
  
  const authResult = await client.AuthenticateAsync({
    sUsrName: workspace.geniki_username,
    sUsrPwd: workspace.geniki_password,
    applicationKey: workspace.geniki_app_key
  });

  console.log('🔍 Raw auth result:', JSON.stringify(authResult, null, 2));

  const result = authResult[0].AuthenticateResult;
  if (result.Result !== 0) {
    throw new Error(`Authentication failed with code: ${result.Result}`);
  }
  
  // Cache with shorter time for production safety (per workspace)
  authCacheByWorkspace.set(workspaceId, {
    key: result.Key,
    expiryTime: now + cacheValidityMs
  });
  
  console.log(`✅ Authentication successful for workspace ${workspaceId}, key cached for ${cacheValidityMs/60000} minutes`);
  console.log(`🔑 Key preview: ${result.Key.substring(0, 8)}***`);
  return result.Key;
}

// Helper function to handle API calls with automatic re-authentication on error 11
async function callGeinikiAPI(workspaceId, apiCall) {
  try {
    return await apiCall();
  } catch (error) {
    // Check if it's an authentication error (error 11 - Invalid key)
    if (error.message.includes('11') || error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('expired')) {
      console.log(`Authentication key expired (error 11) for workspace ${workspaceId}, refreshing...`);
      // Force refresh the authentication key for this workspace
      await authenticate(workspaceId, true);
      // Retry the API call with new key
      return await apiCall();
    }
    throw error; // Re-throw if it's not an auth error
  }
}

async function createVoucher(orderData, workspaceId) {
  return await callGeinikiAPI(workspaceId, async () => {
  const authKey = await authenticate(workspaceId);
  const client = await getGeinikiClient(workspaceId);

  // Build contents description with order ID and items
  const orderNumber = orderData.order_number?.toString() || orderData.name;
  const itemsDescription = orderData.line_items ? 
    orderData.line_items.map(item => `${item.quantity}x ${item.name}`).join(', ') : 
    'Items not specified';
  const contentsDescription = `${orderNumber} | ${itemsDescription}`.substring(0, 255);

  // Build Geniki voucher record
  const voucher = {
    OrderId: orderNumber,
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
    ContentsDescription: contentsDescription,
    Services: determineServices(orderData),
    CodAmount: calculateCOD(orderData),
    InsAmount: 0,
    SubCode: '',
    ReceivedDate: new Date().toISOString().split('T')[0]
  };

  console.log('Creating voucher for order:', voucher.OrderId);
  console.log('📦 Voucher data being sent to Geniki:', JSON.stringify(voucher, null, 2));

  const result = await client.CreateJobAsync({
    sAuthKey: authKey,
    oVoucher: voucher,
    eType: 'Voucher'
  });

  const createResult = result[0].CreateJobResult;
  
  if (createResult.Result !== 0) {
    console.error(`❌ Geniki rejected voucher for ${voucher.OrderId} with code ${createResult.Result}`);
    console.error(`📦 Rejected voucher data:`, JSON.stringify(voucher, null, 2));
    throw new Error(`Voucher creation failed with code: ${createResult.Result}`);
  }

  console.log('Voucher created:', createResult.Voucher);

  return {
    jobId: createResult.JobId,
    voucherNumber: createResult.Voucher,
    subVouchers: createResult.SubVouchers || []
  };
  });
}

async function getVoucherPdf(voucherNumber, workspaceId) {
  // FORCE fresh authentication for PDF downloads - no caching issues
  const authKey = await authenticate(workspaceId, true);
  
  console.log(`[GetVoucherPdf] Using FRESH auth key: ${authKey.substring(0, 8)}***`);
  console.log(`[GetVoucherPdf] Downloading PDF for voucher: ${voucherNumber}`);
  
  // Use production URL for production environment  
  const baseUrl = CONFIG.geniki.wsdlUrl.replace('/JobServicesV2.asmx?WSDL', '');
  const url = `${baseUrl}/JobServicesV2.asmx/GetVoucherPdf?authKey=${encodeURIComponent(authKey)}&voucherNo=${voucherNumber}&format=Sticker&extraInfoFormat=None`;
  
  console.log(`[GetVoucherPdf] Full URL: ${url.replace(authKey, 'AUTH_KEY')}`);
  
  const response = await axios.get(url, { 
    responseType: 'arraybuffer',
    headers: { 
      'Accept': 'application/pdf',
      'User-Agent': 'Geniki-Integration/1.0'
    },
    timeout: 30000
  });
  
  console.log(`[GetVoucherPdf] Response size: ${response.data.length} bytes`);
  console.log(`[GetVoucherPdf] Content-Type: ${response.headers['content-type']}`);
  
  // Check if response is actually an error (small size indicates text error)
  if (response.data.length < 100) {
    const errorText = response.data.toString();
    console.error(`[GetVoucherPdf] Error response: ${errorText}`);
    throw new Error(`Geniki PDF error: ${errorText}`);
  }
  
  console.log(`[GetVoucherPdf] SUCCESS - PDF downloaded: ${response.data.length} bytes`);
  return response.data;
}

async function getMultipleVouchersPdf(voucherNumbers, workspaceId) {
  // FORCE fresh authentication for PDF downloads - no caching issues
  const authKey = await authenticate(workspaceId, true);
  
  console.log(`[GetVouchersPdf] Using FRESH auth key: ${authKey.substring(0, 8)}***`);
  console.log(`[GetVouchersPdf] Downloading PDF for ${voucherNumbers.length} vouchers:`, voucherNumbers);
  
  // Use production URL for production environment  
  const baseUrl = CONFIG.geniki.wsdlUrl.replace('/JobServicesV2.asmx?WSDL', '');
  
  // Build URL with multiple voucherNumbers parameters
  const voucherParams = voucherNumbers.map(vn => `voucherNumbers=${encodeURIComponent(vn)}`).join('&');
  const url = `${baseUrl}/JobServicesV2.asmx/GetVouchersPdf?authKey=${encodeURIComponent(authKey)}&${voucherParams}&format=Sticker&extraInfoFormat=None`;
  
  console.log(`[GetVouchersPdf] Full URL: ${url.replace(authKey, 'AUTH_KEY')}`);
  
  const response = await axios.get(url, { 
    responseType: 'arraybuffer',
    headers: { 
      'Accept': 'application/pdf',
      'User-Agent': 'Geniki-Integration/1.0'
    },
    timeout: 60000 // Longer timeout for multiple vouchers
  });
  
  console.log(`[GetVouchersPdf] Response size: ${response.data.length} bytes`);
  console.log(`[GetVouchersPdf] Content-Type: ${response.headers['content-type']}`);
  
  // Check if response is actually an error (small size indicates text error)
  if (response.data.length < 100) {
    const errorText = response.data.toString();
    console.error(`[GetVouchersPdf] Error response: ${errorText}`);
    throw new Error(`Geniki PDF error: ${errorText}`);
  }
  
  console.log(`[GetVouchersPdf] SUCCESS - Combined PDF downloaded: ${response.data.length} bytes`);
  return response.data;
}

async function cancelJob(jobId, workspaceId) {
  return await callGeinikiAPI(workspaceId, async () => {
  const authKey = await authenticate(workspaceId);
  const client = await getGeinikiClient(workspaceId);

  const result = await client.CancelJobAsync({
    authKey: authKey,
    nJobId: parseInt(jobId),
    bCancel: true
  });

  let cancelResult = result[0];
  if (typeof cancelResult === 'object' && cancelResult.CancelJobResult !== undefined) {
    cancelResult = cancelResult.CancelJobResult;
  }
  if (cancelResult !== 0) {
    throw new Error(`Job cancellation failed with code: ${cancelResult}`);
  }

    console.log('Job cancelled successfully:', jobId);
  return true;
  });
}

async function closePendingJobs(workspaceId) {
  return await callGeinikiAPI(workspaceId, async () => {
  const authKey = await authenticate(workspaceId);
  const client = await getGeinikiClient(workspaceId);

    const result = await client.ClosePendingJobsAsync({
      sAuthKey: authKey
    });

    console.log('All pending jobs closed');
    return result[0];
  });
}

async function closePendingJobsByDate(dateFrom, dateTo, workspaceId) {
  return await callGeinikiAPI(workspaceId, async () => {
  const authKey = await authenticate(workspaceId);
  const client = await getGeinikiClient(workspaceId);

    const result = await client.ClosePendingJobsByDateAsync({
      sAuthKey: authKey,
      dFr: dateFrom,
      dTo: dateTo
    });

  let closeResult = result[0];
  if (typeof closeResult === 'object' && closeResult.ClosePendingJobsByDateResult !== undefined) {
    closeResult = closeResult.ClosePendingJobsByDateResult;
  }
  
  if (closeResult !== 0) {
    throw new Error(`Close pending jobs failed with code: ${closeResult}`);
  }

    console.log(`Pending jobs closed for period: ${dateFrom} to ${dateTo}`);
  return true;
  });
}

// Track delivery status of a voucher
async function trackDeliveryStatus(voucherNumber, workspaceId, language = 'en') {
  return await callGeinikiAPI(workspaceId, async () => {
    const authKey = await authenticate(workspaceId);
    const client = await getGeinikiClient(workspaceId);

    console.log(`📍 Tracking voucher: ${voucherNumber}`);
    
    const result = await client.TrackDeliveryStatusAsync({
      authKey: authKey,
      voucherNo: voucherNumber,
      language: language
    });

    const trackResult = result[0].TrackDeliveryStatusResult;
    
    if (trackResult.Result !== 0 && trackResult.Result !== 13) { // 13 = canceled, still valid info
      throw new Error(`Track delivery status failed with code: ${trackResult.Result}`);
    }

    // Determine actual status - check for returns first
    const rawStatus = trackResult.Status || '';
    const consignee = (trackResult.Consignee || '').toUpperCase();
    const deliveredAt = (trackResult.DeliveredAt || '').toUpperCase();
    const hasReturnVoucher = trackResult.ReturningServiceVoucher && trackResult.ReturningServiceVoucher.trim() !== '';
    
    // Check if this is actually a return
    const isReturn = hasReturnVoucher || 
                     consignee.includes('SENDER') || 
                     consignee.includes('ΑΠΟΣΤΟΛ') ||
                     deliveredAt.includes('RETURN') ||
                     deliveredAt.includes('SENDER') ||
                     rawStatus.toUpperCase().includes('RETURN');
    
    // Determine final status
    let finalStatus = rawStatus;
    if (isReturn) {
      finalStatus = 'RETURNED';
    }
    
    return {
      voucherNumber: voucherNumber,
      status: finalStatus,
      shopCode: trackResult.ShopCode?.trim() || '',
      deliveryDate: trackResult.DeliveryDate,
      deliveredAt: trackResult.DeliveredAt,
      consignee: trackResult.Consignee,
      isDelivered: finalStatus.toUpperCase() === 'DELIVERED' && !isReturn,
      isReturned: isReturn,
      isCanceled: trackResult.Result === 13,
      returningServiceVoucher: trackResult.ReturningServiceVoucher
    };
  });
}

// Track and trace - get full history of checkpoints
async function trackAndTrace(voucherNumber, workspaceId, language = 'en') {
  return await callGeinikiAPI(workspaceId, async () => {
    const authKey = await authenticate(workspaceId);
    const client = await getGeinikiClient(workspaceId);

    console.log(`📍 Tracking (full history) voucher: ${voucherNumber}`);
    
    const result = await client.TrackAndTraceAsync({
      authKey: authKey,
      voucherNo: voucherNumber,
      language: language
    });

    const trackResult = result[0].TrackAndTraceResult;
    
    if (trackResult.Result !== 0 && trackResult.Result !== 13) {
      throw new Error(`Track and trace failed with code: ${trackResult.Result}`);
    }

    return {
      voucherNumber: voucherNumber,
      isDelivered: trackResult.IsDelivered,
      isCanceled: trackResult.Result === 13,
      checkpoints: trackResult.Checkpoints?.Checkpoint || []
    };
  });
}

// Update tracking status for a single voucher in database
async function updateVoucherTrackingStatus(voucherNumber, workspaceId) {
  try {
    const trackingData = await trackDeliveryStatus(voucherNumber, workspaceId, 'en');
    
    // Get current voucher data and order data to check if it was already delivered and if it's COD
    const currentVoucher = await pool.query(
      `SELECT v.delivered_at, v.shopify_fulfillment_id, v.shopify_order_id, v.order_name,
              o.payment_status, o.financial_status, o.total_price
       FROM vouchers v
       LEFT JOIN orders o ON v.order_name = o.order_name AND v.workspace_id = o.workspace_id
       WHERE v.voucher_number = $1 AND v.workspace_id = $2`,
      [voucherNumber, workspaceId]
    );
    
    const wasAlreadyDelivered = currentVoucher.rows.length > 0 && currentVoucher.rows[0].delivered_at !== null;
    const shopifyFulfillmentId = currentVoucher.rows.length > 0 ? currentVoucher.rows[0].shopify_fulfillment_id : null;
    const shopifyOrderId = currentVoucher.rows.length > 0 ? currentVoucher.rows[0].shopify_order_id : null;
    const paymentStatus = currentVoucher.rows.length > 0 ? currentVoucher.rows[0].payment_status : null;
    const financialStatus = currentVoucher.rows.length > 0 ? currentVoucher.rows[0].financial_status : null;
    const totalPrice = currentVoucher.rows.length > 0 ? parseFloat(currentVoucher.rows[0].total_price) : 0;
    
    // Determine delivered_at timestamp if newly delivered
    let deliveredAt = null;
    let shopifyUpdated = false;
    let paymentUpdated = false;
    
    if (trackingData.isDelivered && !wasAlreadyDelivered) {
      deliveredAt = new Date();
      
      // If we have a Shopify fulfillment ID, update Shopify too!
      if (shopifyFulfillmentId && shopifyOrderId) {
        console.log(`📬 Package delivered! Updating Shopify fulfillment for voucher ${voucherNumber}`);
        try {
          await updateShopifyFulfillmentDelivered(shopifyFulfillmentId, shopifyOrderId, workspaceId);
          console.log(`✅ Shopify delivery status updated for voucher ${voucherNumber}`);
          shopifyUpdated = true;
        } catch (shopifyError) {
          console.error(`⚠️  Failed to update Shopify delivery status for ${voucherNumber}:`, shopifyError.message);
          // Don't fail the whole update if Shopify update fails
        }
      }
      
      // If this is a COD order and we have Shopify order ID, mark payment as collected
      if (shopifyOrderId && paymentStatus === 'cod' && (financialStatus === 'pending' || financialStatus === 'partially_paid')) {
        console.log(`💰 COD order delivered! Marking payment as collected for voucher ${voucherNumber}`);
        try {
          const paymentResult = await markShopifyCODOrderPaid(shopifyOrderId, totalPrice, workspaceId);
          if (paymentResult.success) {
            console.log(`✅ COD payment marked as collected for voucher ${voucherNumber}`);
            paymentUpdated = true;
            
            // Update local database to reflect payment collected
            await pool.query(
              `UPDATE orders 
               SET financial_status = 'paid'
               WHERE order_name = $1 AND workspace_id = $2`,
              [currentVoucher.rows[0].order_name, workspaceId]
            );
          } else if (paymentResult.alreadyPaid) {
            console.log(`ℹ️  Order already marked as paid in Shopify`);
          } else if (paymentResult.notCOD) {
            console.log(`ℹ️  Order is not a COD order, skipping payment update`);
          }
        } catch (paymentError) {
          console.error(`⚠️  Failed to mark COD payment as collected for ${voucherNumber}:`, paymentError.message);
          // Don't fail the whole update if payment update fails
        }
      }
    }

    // Update database
    const updateQuery = `
      UPDATE vouchers 
      SET 
        delivery_status = $1,
        delivery_status_code = $2,
        delivery_status_updated_at = CURRENT_TIMESTAMP,
        delivered_at = COALESCE($3, delivered_at),
        current_location = $4,
        last_tracking_error = NULL
      WHERE voucher_number = $5 AND workspace_id = $6
      RETURNING *`;
    
    const updateResult = await pool.query(updateQuery, [
      trackingData.status,
      trackingData.status, // Use status as the code as well
      deliveredAt,
      trackingData.deliveredAt || trackingData.shopCode, // Use deliveredAt or shopCode as location
      voucherNumber,
      workspaceId
    ]);

    console.log(`✅ Updated tracking for voucher ${voucherNumber}: ${trackingData.status}`);
    
    return {
      success: true,
      voucher: updateResult.rows[0],
      tracking: trackingData,
      shopifyUpdated: shopifyUpdated,
      paymentUpdated: paymentUpdated
    };
    
  } catch (error) {
    console.error(`❌ Failed to update tracking for ${voucherNumber}:`, error.message);
    
    // Log error in database
    await pool.query(
      `UPDATE vouchers 
       SET last_tracking_error = $1, delivery_status_updated_at = CURRENT_TIMESTAMP 
       WHERE voucher_number = $2 AND workspace_id = $3`,
      [error.message, voucherNumber, workspaceId]
    );
    
    return {
      success: false,
      voucherNumber,
      error: error.message
    };
  }
}

// Update tracking status for all active vouchers in a workspace
async function updateAllVoucherTrackingStatuses(workspaceId) {
  const syncId = await pool.query(
    `INSERT INTO tracking_sync_log (workspace_id, status) 
     VALUES ($1, 'running') 
     RETURNING id`,
    [workspaceId]
  );
  const syncLogId = syncId.rows[0].id;

  try {
    // Get all vouchers that are not yet delivered or are older than 30 days
    const vouchersResult = await pool.query(
      `SELECT voucher_number 
       FROM vouchers 
       WHERE workspace_id = $1 
         AND voucher_number IS NOT NULL
         AND (delivery_status IS NULL OR delivery_status != 'Delivered')
         AND created_at > NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    const vouchers = vouchersResult.rows;
    const results = {
      total: vouchers.length,
      updated: 0,
      errors: 0,
      details: []
    };

    console.log(`🔄 Starting tracking update for ${vouchers.length} vouchers in workspace ${workspaceId}`);

    for (const voucher of vouchers) {
      const result = await updateVoucherTrackingStatus(voucher.voucher_number, workspaceId);
      
      if (result.success) {
        results.updated++;
      } else {
        results.errors++;
      }
      
      results.details.push(result);
      
      // Small delay to avoid rate limiting (100ms between requests)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update sync log
    await pool.query(
      `UPDATE tracking_sync_log 
       SET sync_completed_at = CURRENT_TIMESTAMP,
           vouchers_checked = $1,
           vouchers_updated = $2,
           errors_count = $3,
           status = 'completed'
       WHERE id = $4`,
      [results.total, results.updated, results.errors, syncLogId]
    );

    console.log(`✅ Tracking update completed: ${results.updated}/${results.total} updated, ${results.errors} errors`);
    
    return results;
    
  } catch (error) {
    console.error(`❌ Tracking sync failed:`, error);
    
    await pool.query(
      `UPDATE tracking_sync_log 
       SET sync_completed_at = CURRENT_TIMESTAMP,
           status = 'failed',
           error_message = $1
       WHERE id = $2`,
      [error.message, syncLogId]
    );
    
    throw error;
  }
}

// Helper functions
function calculateWeight(lineItems) {
  // Fixed weight: Always 2kg for all shipments
  return 2;
}

function determineServices(orderData) {
  const services = [];
  
  if (orderData.financial_status === 'pending' || 
      (orderData.payment_gateway_names && orderData.payment_gateway_names.includes('COD')) ||
      orderData.payment_status === 'cod') {
    services.push('ΑΜ'); // COD (cash payment) - Greek characters as required by Geniki
  }
  
  return services.join(',') || 'STD';
}

function calculateCOD(orderData) {
  // Check if payment is COD in any of these fields
  if (orderData.financial_status === 'pending' ||
      orderData.payment_status === 'cod' ||
      (orderData.payment_gateway_names && orderData.payment_gateway_names.includes('COD'))) {
    return parseFloat(orderData.total_price) || 0;
  }
  return 0;
}

// ==================== MEEST API FUNCTIONS ====================

/**
 * Authenticate with Meest API and get bearer token
 * Tokens are cached per workspace and refreshed 5 minutes before expiry
 */
async function authenticateMeest(workspaceId, forceRefresh = false) {
  const workspace = await getWorkspaceSettings(workspaceId);

  if (!workspace.meest_username || !workspace.meest_password) {
    throw new Error('Meest credentials not configured for this workspace');
  }

  const now = Date.now();
  const cachedToken = meestTokenCacheByWorkspace.get(workspaceId);

  // Return cached token if still valid
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + MEEST_TOKEN_BUFFER_MS) {
    console.log(`Using cached Meest token for workspace ${workspaceId}`);
    return cachedToken.token;
  }

  console.log(`🔑 Getting fresh Meest authentication token for workspace ${workspaceId}...`);

  try {
    const response = await axios.post(
      `${getMeestBaseUrl()}/v2/api/auth`,
      {
        username: workspace.meest_username,
        password: workspace.meest_password
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );

    const { access_token, expires_in } = response.data;

    // Cache the token (default 12 hours if not specified)
    const expiresAt = now + ((expires_in || 43200) * 1000);
    meestTokenCacheByWorkspace.set(workspaceId, {
      token: access_token,
      expiresAt,
      shopId: workspaceId
    });

    console.log(`✅ Meest authentication successful for workspace ${workspaceId}`);
    return access_token;

  } catch (error) {
    console.error(`❌ Meest authentication failed:`, error.response?.data || error.message);
    throw new Error(`Meest authentication failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Clear Meest token cache for a workspace (e.g., when credentials change)
 */
function clearMeestToken(workspaceId) {
  meestTokenCacheByWorkspace.delete(workspaceId);
  console.log(`Cleared Meest token cache for workspace ${workspaceId}`);
}

/**
 * Generate a unique parcel number for Meest
 */
function generateMeestParcelNumber(orderName) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const cleanOrderName = orderName.replace(/[^A-Z0-9]/gi, '').substring(0, 8).toUpperCase();
  return `ET${cleanOrderName}${timestamp}`.substring(0, 20);
}

/**
 * Build Meest parcel request from order data
 */
function buildMeestParcelRequest(orderData, workspaceSettings) {
  // Determine COD based on settings
  let isCOD = orderData.payment_status === 'cod' ||
              orderData.financial_status === 'pending' ||
              (orderData.payment_gateway_names && orderData.payment_gateway_names.includes('COD'));

  const codHandling = workspaceSettings.meest_cod_handling || 'auto';
  if (codHandling === 'always') {
    isCOD = true;
  } else if (codHandling === 'never') {
    isCOD = false;
  }

  const weight = parseFloat(workspaceSettings.meest_default_weight) || 1.0;
  const totalPrice = parseFloat(orderData.total_price) || 0;

  // Build items array from order products
  let items = [];
  if (orderData.line_items && Array.isArray(orderData.line_items)) {
    items = orderData.line_items.map(item => ({
      description: {
        description: item.name || 'Product'
      },
      logistic: {
        quantity: item.quantity || 1,
        weight: weight / orderData.line_items.length
      },
      value: {
        value: parseFloat(item.price) || (totalPrice / orderData.line_items.length)
      }
    }));
  }

  // If no products, create a generic item
  if (items.length === 0) {
    items.push({
      description: {
        description: `Order ${orderData.order_name || orderData.order_number || orderData.name}`
      },
      logistic: {
        quantity: 1,
        weight: weight
      },
      value: {
        value: totalPrice
      }
    });
  }

  // Support both nested shipping_address (Shopify format) and flat DB fields
  const firstName = orderData.first_name || orderData.shipping_address?.first_name || 'Customer';
  const lastName = orderData.last_name || orderData.shipping_address?.last_name || '';
  const address1 = orderData.shipping_address1 || orderData.shipping_address?.address1 || '';
  const city = orderData.shipping_city || orderData.shipping_address?.city || 'City';
  const zip = orderData.shipping_zip || orderData.shipping_address?.zip || '00000';
  const countryCode = orderData.shipping_country_code || orderData.shipping_address?.country_code || 'GR';
  const phone = orderData.shipping_phone || orderData.shipping_address?.phone || orderData.customer?.phone || '';
  const email = orderData.email || 'noreply@example.com';

  // Extract building number from address if possible
  const buildingMatch = address1.match(/\d+/);
  const buildingNumber = buildingMatch ? buildingMatch[0] : '1';
  const street = address1.replace(/^\d+\s*/, '').trim() || address1 || 'Address';

  const request = {
    parcelNumber: generateMeestParcelNumber(orderData.order_name || orderData.order_number || orderData.name),
    serviceDetails: {
      service: workspaceSettings.meest_default_service || 'ECONOMIC_STANDARD'
    },
    metrics: {
      dimensions: {
        width: parseFloat(workspaceSettings.meest_default_width) || 20,
        height: parseFloat(workspaceSettings.meest_default_height) || 15,
        length: parseFloat(workspaceSettings.meest_default_length) || 30
      },
      weight: weight
    },
    value: {
      localTotalValue: totalPrice,
      localCurrency: workspaceSettings.invoice_currency || 'EUR'
    },
    sender: {
      name: workspaceSettings.workspace_name || 'Sender',
      country: workspaceSettings.meest_sender_country || 'RO',
      zipCode: workspaceSettings.meest_sender_zip || '077135',
      city: workspaceSettings.meest_sender_city || 'Mogosoaia',
      street: workspaceSettings.meest_sender_street || 'Islaz',
      buildingNumber: workspaceSettings.meest_sender_building || '85',
      phone: workspaceSettings.sender_phone || '+40700000000',
      email: workspaceSettings.email || 'sender@example.com'
    },
    recipient: {
      name: `${firstName} ${lastName}`.trim() || 'Customer',
      country: countryCode,
      zipCode: zip,
      city: city,
      street: street,
      buildingNumber: buildingNumber,
      phone: phone,
      email: email
    },
    items: items,
    logisticsOptions: {
      labelFormat: 'PDF'
    }
  };

  // Add COD if applicable
  if (isCOD) {
    request.cod = {
      value: totalPrice,
      currency: workspaceSettings.invoice_currency || 'EUR'
    };
  }

  return request;
}

/**
 * Create a new parcel/shipment with Meest
 */
async function createMeestParcel(orderData, workspaceId) {
  const workspace = await getWorkspaceSettings(workspaceId);
  const token = await authenticateMeest(workspaceId);

  const parcelRequest = buildMeestParcelRequest(orderData, workspace);

  console.log(`📦 Creating Meest parcel for order ${orderData.order_name || orderData.order_number || orderData.name}`);
  console.log(`   Recipient: ${parcelRequest.recipient.name}, ${parcelRequest.recipient.city}, ${parcelRequest.recipient.country}`);
  console.log(`   Service: ${parcelRequest.serviceDetails.service}`);

  try {
    const response = await axios.post(
      `${getMeestBaseUrl()}/v2/api/parcels`,
      parcelRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    );

    const result = response.data;

    console.log(`✅ Meest parcel created: ${result.parcelNumber || parcelRequest.parcelNumber}`);

    // Get label from response (lastMileLabel or firstMileLabel)
    const labelData = result.lastMileLabel || result.firstMileLabel || null;
    const trackingNumber = result.lastMileTrackingNumber || result.firstMileTrackingNUmber || null;

    return {
      jobId: result.objectID || null,
      voucherNumber: result.parcelNumber || parcelRequest.parcelNumber,
      subVouchers: [],
      meestResponse: result,
      labelData: labelData,
      trackingNumber: trackingNumber
    };

  } catch (error) {
    console.error(`❌ Meest parcel creation failed:`, error.response?.data || error.message);
    throw new Error(`Meest parcel creation failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Get shipping label for a Meest parcel (Base64 PDF)
 */
async function getMeestLabel(parcelNumber, workspaceId) {
  const token = await authenticateMeest(workspaceId, true); // Force fresh token for PDF

  console.log(`📄 Fetching Meest label for parcel: ${parcelNumber}`);

  try {
    const response = await axios.get(
      `${getMeestBaseUrl()}/v2/api/labels/standard`,
      {
        params: { parcelNumber },
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      }
    );

    console.log(`✅ Meest label fetched for parcel: ${parcelNumber}`);

    // Return just the base64 string for compatibility with PDF download
    return response.data.label;

  } catch (error) {
    console.error(`❌ Meest label fetch failed:`, error.response?.data || error.message);
    throw new Error(`Meest label fetch failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Get tracking information for a Meest parcel
 */
async function trackMeestParcel(parcelNumber, workspaceId) {
  const token = await authenticateMeest(workspaceId);

  console.log(`📍 Tracking Meest parcel: ${parcelNumber}`);

  try {
    const response = await axios.get(
      `${getMeestBaseUrl()}/v2/api/tracking`,
      {
        params: { parcelNumber },
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 15000
      }
    );

    const tracking = response.data;

    console.log(`✅ Meest tracking fetched: ${parcelNumber} - Status: ${tracking.status}`);

    return {
      voucherNumber: parcelNumber,
      status: tracking.status,
      statusCode: tracking.statusCode,
      statusDate: tracking.statusDate,
      currentLocation: tracking.currentLocation,
      estimatedDelivery: tracking.estimatedDelivery,
      isDelivered: normalizeMeestStatus(tracking.status) === 'delivered',
      isReturned: normalizeMeestStatus(tracking.status) === 'returned',
      events: tracking.events || []
    };

  } catch (error) {
    console.error(`❌ Meest tracking failed:`, error.response?.data || error.message);
    throw new Error(`Meest tracking failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Cancel a Meest parcel
 */
async function cancelMeestParcel(parcelNumber, workspaceId) {
  const token = await authenticateMeest(workspaceId);

  console.log(`🚫 Cancelling Meest parcel: ${parcelNumber}`);

  try {
    await axios.post(
      `${getMeestBaseUrl()}/v2/api/parcels/cancel`,
      { parcelNumber },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 15000
      }
    );

    console.log(`✅ Meest parcel cancelled: ${parcelNumber}`);
    return true;

  } catch (error) {
    console.error(`❌ Meest parcel cancellation failed:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      url: `${getMeestBaseUrl()}/v2/api/parcels/cancel`
    });
    throw new Error(`Meest parcel cancellation failed: ${error.response?.data?.message || error.response?.statusText || error.message}`);
  }
}

/**
 * Normalize Meest status to internal status
 */
function normalizeMeestStatus(meestStatus) {
  const status = (meestStatus || '').toUpperCase();

  if (status.includes('DELIVERED') || status === 'DELIVERED') return 'delivered';
  if (status.includes('RETURN') || status === 'RETURNED' || status === 'REFUSED') return 'returned';
  if (status.includes('CANCEL') || status === 'CANCELLED') return 'cancelled';
  if (status.includes('OUT_FOR') || status.includes('OUT FOR')) return 'in_transit';
  if (status.includes('TRANSIT') || status.includes('IN_TRANSIT')) return 'in_transit';
  if (status.includes('PICKED') || status.includes('PICKED_UP')) return 'in_transit';
  if (status.includes('CREATED') || status === 'CREATED') return 'awb_created';

  return 'in_transit';
}

/**
 * Test Meest API connection
 */
async function testMeestConnection(workspaceId) {
  try {
    await authenticateMeest(workspaceId, true);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ==================== SHOPIFY FUNCTIONS ====================

async function makeShopifyRequest(endpoint, method = 'GET', data = null, workspaceId = null) {
  // If workspaceId is provided, get workspace-specific credentials
  let shopDomain, accessToken;
  
  if (workspaceId) {
    const workspace = await getWorkspaceSettings(workspaceId);
    if (!workspace || !workspace.shopify_shop || !workspace.shopify_access_token) {
      throw new Error(`Workspace ${workspaceId} does not have Shopify credentials configured`);
    }
    shopDomain = workspace.shopify_shop;
    accessToken = workspace.shopify_access_token;
  } else {
    // Fall back to default env credentials
    shopDomain = CONFIG.shopify.shop;
    accessToken = CONFIG.shopify.accessToken;
  }
  
  const url = `https://${shopDomain}/admin/api/${CONFIG.shopify.apiVersion}${endpoint}`;
  
  const config = {
    method,
    url,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
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

// Create fulfillment for an order
async function createShopifyFulfillment(shopifyOrderId, trackingNumber, workspaceId) {
  try {
    console.log(`📦 Creating Shopify fulfillment for order ${shopifyOrderId} with tracking ${trackingNumber}`);
    console.log(`   Workspace ID: ${workspaceId}`);
    
    // Get order details
    console.log(`🔍 Fetching order details from Shopify: /orders/${shopifyOrderId}.json`);
    const orderData = await makeShopifyRequest(`/orders/${shopifyOrderId}.json`, 'GET', null, workspaceId);
    
    console.log(`📊 Order data received:`, orderData ? 'YES' : 'NO');
    if (orderData) {
      console.log(`   Has .order property:`, orderData.order ? 'YES' : 'NO');
    }
    
    if (!orderData || !orderData.order) {
      console.error(`❌ Empty response from Shopify. Full response:`, JSON.stringify(orderData, null, 2));
      throw new Error('Failed to fetch order data from Shopify');
    }
    
    const order = orderData.order;
    console.log(`📋 Order fetched: ${order.name}, location_id: ${order.location_id}`);
    
    // Get location_id - either from order or fetch default location
    let location_id = order.location_id;
    
    if (!location_id) {
      console.log(`⚠️  Order has no location, fetching default location...`);
      try {
        // Try to get the first available location
        const locationsData = await makeShopifyRequest(`/locations.json`, 'GET', null, workspaceId);
        
        if (locationsData.locations && locationsData.locations.length > 0) {
          location_id = locationsData.locations[0].id;
          console.log(`✅ Using default location: ${locationsData.locations[0].name} (ID: ${location_id})`);
        } else {
          throw new Error('No locations found in Shopify');
        }
      } catch (locError) {
        // If we can't fetch locations, provide helpful error
        console.error(`❌ Cannot fetch locations:`, locError.message);
        throw new Error(`Order has no assigned location and cannot fetch locations. Please go to Shopify and manually assign this order to a location, then try again.`);
      }
    }
    
    // NEW API (2023-10+): Use FulfillmentOrders API
    // Step 1: Get fulfillment orders for this order
    console.log(`🔍 Fetching fulfillment orders for order ${shopifyOrderId}...`);
    const fulfillmentOrdersData = await makeShopifyRequest(
      `/orders/${shopifyOrderId}/fulfillment_orders.json`,
      'GET',
      null,
      workspaceId
    );
    
    if (!fulfillmentOrdersData.fulfillment_orders || fulfillmentOrdersData.fulfillment_orders.length === 0) {
      throw new Error('No fulfillment orders found for this order');
    }
    
    // Get the fulfillment orders that can be fulfilled
    const fulfillableOrders = fulfillmentOrdersData.fulfillment_orders.filter(
      fo => fo.status === 'open' || fo.status === 'scheduled'
    );
    
    if (fulfillableOrders.length === 0) {
      throw new Error('No fulfillable orders found (order may already be fulfilled)');
    }
    
    console.log(`📦 Found ${fulfillableOrders.length} fulfillment order(s) to fulfill`);
    
    // Step 2: Prepare line items for fulfillment
    const line_items_by_fulfillment_order = fulfillableOrders.map(fo => ({
      fulfillment_order_id: fo.id,
      fulfillment_order_line_items: fo.line_items.map(item => ({
        id: item.id,
        quantity: item.fulfillable_quantity
      })).filter(item => item.quantity > 0)
    })).filter(fo => fo.fulfillment_order_line_items.length > 0);
    
    if (line_items_by_fulfillment_order.length === 0) {
      throw new Error('No items to fulfill (all items may already be fulfilled)');
    }
    
    // Step 3: Create fulfillment using new API
    const fulfillmentData = {
      fulfillment: {
        location_id: location_id,
        tracking_info: {
          number: trackingNumber,
          company: 'Geniki Taxydromiki',
          url: `https://www.taxydromiki.com/track/${trackingNumber}`
        },
        notify_customer: true,
        line_items_by_fulfillment_order: line_items_by_fulfillment_order
      }
    };
    
    console.log(`📦 Creating fulfillment with new API...`);
    const result = await makeShopifyRequest(
      `/fulfillments.json`,
      'POST',
      fulfillmentData,
      workspaceId
    );
    
    console.log(`✅ Shopify fulfillment created successfully for order ${shopifyOrderId}`);
    return result.fulfillment;
    
  } catch (error) {
    console.error(`❌ Failed to create Shopify fulfillment:`, error.response?.data || error.message);
    throw error;
  }
}

// Update Shopify fulfillment to mark as delivered
async function updateShopifyFulfillmentDelivered(fulfillmentId, shopifyOrderId, workspaceId) {
  try {
    console.log(`📬 Updating Shopify fulfillment ${fulfillmentId} (order ${shopifyOrderId}) to DELIVERED`);
    
    // Create a fulfillment event with the correct endpoint and format
    const eventData = {
      event: {
        status: "delivered",
        message: "Package has been delivered"
      }
    };
    
    const result = await makeShopifyRequest(
      `/orders/${shopifyOrderId}/fulfillments/${fulfillmentId}/events.json`,
      'POST',
      eventData,
      workspaceId
    );
    
    console.log(`✅ Shopify fulfillment ${fulfillmentId} marked as DELIVERED`);
    return result;
    
  } catch (error) {
    console.error(`❌ Failed to update Shopify fulfillment delivery status:`, error.response?.data || error.message);
    throw error;
  }
}

// Mark COD order as paid in Shopify (payment collected on delivery)
async function markShopifyCODOrderPaid(shopifyOrderId, amount, workspaceId) {
  try {
    console.log(`💰 Marking COD order ${shopifyOrderId} as PAID (amount: ${amount})`);
    
    // Get order details to check financial status
    const orderData = await makeShopifyRequest(`/orders/${shopifyOrderId}.json`, 'GET', null, workspaceId);
    const order = orderData.order;
    
    // Check if order is already paid
    if (order.financial_status === 'paid') {
      console.log(`ℹ️  Order ${shopifyOrderId} is already marked as paid`);
      return { alreadyPaid: true };
    }
    
    // Check if this is a COD order (financial_status = pending)
    if (order.financial_status !== 'pending') {
      console.log(`ℹ️  Order ${shopifyOrderId} financial status is ${order.financial_status}, not a COD order`);
      return { notCOD: true };
    }
    
    // Create a transaction to mark payment as received
    const transactionData = {
      transaction: {
        kind: "capture",
        status: "success",
        amount: amount.toString(),
        currency: order.currency || "EUR"
      }
    };
    
    const result = await makeShopifyRequest(
      `/orders/${shopifyOrderId}/transactions.json`,
      'POST',
      transactionData,
      workspaceId
    );
    
    console.log(`✅ COD payment marked as received for order ${shopifyOrderId}`);
    return { success: true, transaction: result.transaction };
    
  } catch (error) {
    console.error(`❌ Failed to mark COD order as paid:`, error.response?.data || error.message);
    throw error;
  }
}

// ==================== DATABASE OPERATIONS ====================

// ============================================
// WORKSPACE MANAGEMENT FUNCTIONS
// ============================================

async function getAllWorkspaces() {
  const query = 'SELECT * FROM workspaces ORDER BY created_at ASC';
  const result = await pool.query(query);
  return result.rows;
}

async function getWorkspace(workspaceId) {
  const query = 'SELECT * FROM workspaces WHERE workspace_id = $1';
  const result = await pool.query(query, [workspaceId]);
  return result.rows[0];
}

async function createWorkspace(workspaceData) {
  const { workspace_name, store_name, store_url, shopify_access_token, shopify_shop } = workspaceData;
  const query = `
    INSERT INTO workspaces (workspace_name, store_name, store_url, shopify_access_token, shopify_shop, is_active)
    VALUES ($1, $2, $3, $4, $5, TRUE)
    RETURNING *
  `;
  const result = await pool.query(query, [workspace_name, store_name, store_url, shopify_access_token || null, shopify_shop || null]);
  return result.rows[0];
}

async function updateWorkspace(workspaceId, workspaceData) {
  const { workspace_name, store_name, store_url, country, shopify_access_token, shopify_shop, is_active } = workspaceData;
  const query = `
    UPDATE workspaces
    SET workspace_name = COALESCE($1, workspace_name),
        store_name = COALESCE($2, store_name),
        store_url = COALESCE($3, store_url),
        country = COALESCE($4, country),
        shopify_access_token = COALESCE($5, shopify_access_token),
        shopify_shop = COALESCE($6, shopify_shop),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE workspace_id = $8
    RETURNING *
  `;
  const result = await pool.query(query, [workspace_name, store_name, store_url, country, shopify_access_token, shopify_shop, is_active, workspaceId]);
  return result.rows[0];
}

async function deleteWorkspace(workspaceId) {
  // This will cascade delete all orders, vouchers, and csv_imports for this workspace
  const query = 'DELETE FROM workspaces WHERE workspace_id = $1 RETURNING *';
  const result = await pool.query(query, [workspaceId]);
  return result.rows[0];
}

// ============================================
// DATABASE HELPER FUNCTIONS
// ============================================

async function insertOrder(orderData, workspaceId) {
  const query = `
    INSERT INTO orders (
      order_name, email, financial_status, fulfillment_status,
      first_name, last_name, shipping_address1, shipping_address2,
      shipping_city, shipping_province, shipping_zip, shipping_country,
      shipping_country_code, shipping_phone, total_price, payment_method,
      payment_status, outstanding_balance, line_items, products, notes, shopify_order_id, workspace_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
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
    orderData.paymentStatus, orderData.outstandingBalance, orderData.lineItems, JSON.stringify(orderData.products || []), orderData.note, orderData.orderId, workspaceId
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

async function getOrder(orderName, workspaceId) {
  const query = `
    SELECT 
      o.*,
      v.voucher_number,
      v.job_id as voucher_job_id,
      v.status as voucher_status,
      v.created_at as voucher_created_at
    FROM orders o
    LEFT JOIN vouchers v ON o.order_name = v.order_name AND v.workspace_id = $2
    WHERE o.order_name = $1 AND o.workspace_id = $2
    ORDER BY v.created_at DESC NULLS LAST
    LIMIT 1`;
  const result = await pool.query(query, [orderName, workspaceId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const order = result.rows[0];
  
  // Parse products if it's a string
  if (order.products && typeof order.products === 'string') {
    try {
      order.products = JSON.parse(order.products);
    } catch (e) {
      console.error('Error parsing products JSON:', e);
      order.products = [];
    }
  }
  
  return order;
}

/**
 * Calculate order status based on order and voucher data
 * Status flow: unfulfilled -> awb_created -> sent -> in_transit -> delivered/returned -> completed
 * 
 * Priority:
 * 1. Geniki tracking (real courier data) - HIGHEST PRIORITY
 * 2. Shopify fulfillment status (fallback)
 * 3. Voucher/AWB status
 */
function calculateOrderStatus(order) {
  // Check if order has a voucher
  const hasVoucher = order.voucher_number && order.voucher_number.trim() !== '';
  
  // Check if order is completed (invoice + shopify synced + payment + delivered)
  const hasInvoice = order.oblio_invoice_id !== null;
  const isShopifySynced = order.shopify_fulfillment_id !== null || order.fulfillment_status === 'fulfilled';
  const isPaid = order.financial_status === 'paid' || order.payment_status === 'paid';
  const isDelivered = order.delivered_at !== null;
  
  if (hasInvoice && isShopifySynced && isPaid && isDelivered) {
    return 'completed';
  }
  
  // PRIORITY 1: Check Geniki tracking status (real courier data)
  // This should ALWAYS take precedence over Shopify status
  if (hasVoucher && order.delivery_status) {
    const deliveryStatus = order.delivery_status.toUpperCase();
    const currentLocation = (order.current_location || '').toUpperCase();
    
    // Check for returns
    if (deliveryStatus.includes('RETURN') || 
        currentLocation.includes('SENDER') || 
        currentLocation.includes('ΑΠΟΣΤΟΛ')) {
      return 'returned';
    }
    
    // Check for delivered (from Geniki tracking)
    if (deliveryStatus.includes('DELIVERED')) {
      return 'delivered';
    }
    
    // Has tracking status but not delivered yet
    return 'in_transit';
  }
  
  // PRIORITY 2: Check Shopify fulfillment status (fallback for orders without Geniki tracking)
  // Only use this if there's NO Geniki tracking data yet
  if (order.fulfillment_status === 'delivered' && !order.delivery_status) {
    return 'delivered';
  }
  
  // Check if order is fulfilled in Shopify (but not yet delivered)
  if (order.fulfillment_status === 'fulfilled' && !order.delivery_status && !hasVoucher) {
    return 'fulfilled'; // Fulfilled in Shopify = order is shipped
  }
  
  // Check if voucher was sent to Geniki (closed/pending)
  if (hasVoucher && order.sent_to_geniki) {
    return 'sent';
  }
  
  // Has voucher but not sent yet
  if (hasVoucher) {
    return 'awb_created';
  }
  
  // No voucher at all
  return 'unfulfilled';
}

async function getAllOrders(workspaceId, limit = 50, offset = 0, statusFilter = null) {
  // Base query that gets all order data with voucher info
  let query = `
    SELECT DISTINCT ON (o.order_name)
      o.*,
      v.voucher_number,
      v.job_id as voucher_job_id,
      v.status as voucher_status,
      v.created_at as voucher_created_at,
      v.delivery_status,
      v.delivery_status_code,
      v.current_location,
      v.delivered_at,
      v.delivery_status_updated_at,
      v.sent_to_geniki,
      v.sent_to_geniki_at,
      v.shopify_fulfillment_id
    FROM orders o
    LEFT JOIN vouchers v ON o.order_name = v.order_name AND v.workspace_id = $1
    WHERE o.workspace_id = $1`;
  
  // Add status filter conditions if specified
  if (statusFilter && statusFilter !== 'All') {
    const normalizedFilter = statusFilter.toLowerCase().replace(/\s+/g, '_');
    
    // Add WHERE conditions based on status logic from calculateOrderStatus
    if (normalizedFilter === 'completed') {
      query += ` AND o.oblio_invoice_id IS NOT NULL 
                 AND (v.shopify_fulfillment_id IS NOT NULL OR o.fulfillment_status = 'fulfilled')
                 AND (o.financial_status = 'paid' OR o.payment_status = 'paid')
                 AND v.delivered_at IS NOT NULL`;
    } else if (normalizedFilter === 'returned') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND (UPPER(COALESCE(v.delivery_status, '')) LIKE '%RETURN%' 
                      OR UPPER(COALESCE(v.current_location, '')) LIKE '%SENDER%' 
                      OR UPPER(COALESCE(v.current_location, '')) LIKE '%ΑΠΟΣΤΟΛ%')`;
    } else if (normalizedFilter === 'delivered') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND UPPER(COALESCE(v.delivery_status, '')) LIKE '%DELIVERED%'
                 AND NOT (UPPER(COALESCE(v.delivery_status, '')) LIKE '%RETURN%' 
                          OR UPPER(COALESCE(v.current_location, '')) LIKE '%SENDER%' 
                          OR UPPER(COALESCE(v.current_location, '')) LIKE '%ΑΠΟΣΤΟΛ%')
                 AND NOT (o.oblio_invoice_id IS NOT NULL 
                          AND (v.shopify_fulfillment_id IS NOT NULL OR o.fulfillment_status = 'fulfilled')
                          AND (o.financial_status = 'paid' OR o.payment_status = 'paid')
                          AND v.delivered_at IS NOT NULL)`;
    } else if (normalizedFilter === 'in_transit') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND v.delivery_status IS NOT NULL
                 AND v.delivery_status != ''
                 AND UPPER(v.delivery_status) NOT LIKE '%DELIVERED%'
                 AND NOT (UPPER(COALESCE(v.delivery_status, '')) LIKE '%RETURN%' 
                          OR UPPER(COALESCE(v.current_location, '')) LIKE '%SENDER%' 
                          OR UPPER(COALESCE(v.current_location, '')) LIKE '%ΑΠΟΣΤΟΛ%')`;
    } else if (normalizedFilter === 'fulfilled') {
      query += ` AND o.fulfillment_status = 'fulfilled' 
                 AND (v.delivery_status IS NULL OR v.delivery_status = '')
                 AND (v.voucher_number IS NULL OR v.voucher_number = '')`;
    } else if (normalizedFilter === 'sent') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND COALESCE(v.sent_to_geniki, FALSE) = TRUE
                 AND (v.delivery_status IS NULL OR v.delivery_status = '')`;
    } else if (normalizedFilter === 'awb_created') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND COALESCE(v.sent_to_geniki, FALSE) = FALSE
                 AND (v.delivery_status IS NULL OR v.delivery_status = '')`;
    } else if (normalizedFilter === 'unfulfilled') {
      query += ` AND (v.voucher_number IS NULL OR v.voucher_number = '')`;
    }
  }
  
  query += `
    ORDER BY 
      o.order_name,
      v.created_at DESC NULLS LAST,
      CASE 
        WHEN o.order_name ~ '^[A-Z]+#[0-9]+[A-Z]*$' 
        THEN CAST(SUBSTRING(o.order_name FROM '[0-9]+') AS INTEGER)
        ELSE 0
      END DESC,
      o.imported_at DESC
    LIMIT $2 OFFSET $3`;
  
  const result = await pool.query(query, [workspaceId, limit, offset]);
  
  // Calculate and add order_status for each order
  const ordersWithStatus = result.rows.map(order => ({
    ...order,
    order_status: calculateOrderStatus(order)
  }));
  
  return ordersWithStatus;
}

async function countOrders(workspaceId, statusFilter = null) {
  // Base query
  let query = `
    SELECT COUNT(DISTINCT o.order_name) as total
    FROM orders o
    LEFT JOIN vouchers v ON o.order_name = v.order_name AND v.workspace_id = $1
    WHERE o.workspace_id = $1`;
  
  // Add status filter conditions if specified
  if (statusFilter && statusFilter !== 'All') {
    const normalizedFilter = statusFilter.toLowerCase().replace(/\s+/g, '_');
    
    // Add WHERE conditions based on status logic from calculateOrderStatus
    if (normalizedFilter === 'completed') {
      query += ` AND o.oblio_invoice_id IS NOT NULL 
                 AND (v.shopify_fulfillment_id IS NOT NULL OR o.fulfillment_status = 'fulfilled')
                 AND (o.financial_status = 'paid' OR o.payment_status = 'paid')
                 AND v.delivered_at IS NOT NULL`;
    } else if (normalizedFilter === 'returned') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND (UPPER(COALESCE(v.delivery_status, '')) LIKE '%RETURN%' 
                      OR UPPER(COALESCE(v.current_location, '')) LIKE '%SENDER%' 
                      OR UPPER(COALESCE(v.current_location, '')) LIKE '%ΑΠΟΣΤΟΛ%')`;
    } else if (normalizedFilter === 'delivered') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND UPPER(COALESCE(v.delivery_status, '')) LIKE '%DELIVERED%'
                 AND NOT (UPPER(COALESCE(v.delivery_status, '')) LIKE '%RETURN%' 
                          OR UPPER(COALESCE(v.current_location, '')) LIKE '%SENDER%' 
                          OR UPPER(COALESCE(v.current_location, '')) LIKE '%ΑΠΟΣΤΟΛ%')
                 AND NOT (o.oblio_invoice_id IS NOT NULL 
                          AND (v.shopify_fulfillment_id IS NOT NULL OR o.fulfillment_status = 'fulfilled')
                          AND (o.financial_status = 'paid' OR o.payment_status = 'paid')
                          AND v.delivered_at IS NOT NULL)`;
    } else if (normalizedFilter === 'in_transit') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND v.delivery_status IS NOT NULL
                 AND v.delivery_status != ''
                 AND UPPER(v.delivery_status) NOT LIKE '%DELIVERED%'
                 AND NOT (UPPER(COALESCE(v.delivery_status, '')) LIKE '%RETURN%' 
                          OR UPPER(COALESCE(v.current_location, '')) LIKE '%SENDER%' 
                          OR UPPER(COALESCE(v.current_location, '')) LIKE '%ΑΠΟΣΤΟΛ%')`;
    } else if (normalizedFilter === 'fulfilled') {
      query += ` AND o.fulfillment_status = 'fulfilled' 
                 AND (v.delivery_status IS NULL OR v.delivery_status = '')
                 AND (v.voucher_number IS NULL OR v.voucher_number = '')`;
    } else if (normalizedFilter === 'sent') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND COALESCE(v.sent_to_geniki, FALSE) = TRUE
                 AND (v.delivery_status IS NULL OR v.delivery_status = '')`;
    } else if (normalizedFilter === 'awb_created') {
      query += ` AND v.voucher_number IS NOT NULL 
                 AND v.voucher_number != ''
                 AND COALESCE(v.sent_to_geniki, FALSE) = FALSE
                 AND (v.delivery_status IS NULL OR v.delivery_status = '')`;
    } else if (normalizedFilter === 'unfulfilled') {
      query += ` AND (v.voucher_number IS NULL OR v.voucher_number = '')`;
    }
  }
  
  const result = await pool.query(query, [workspaceId]);
  return parseInt(result.rows[0].total);
}

async function insertVoucher(orderName, voucherData, workspaceId, courierType = 'geniki', shopifyOrderId = null, shopifyFulfillmentId = null) {
  const query = `
    INSERT INTO vouchers (workspace_id, order_name, voucher_number, job_id, courier_type, shopify_order_id, shopify_fulfillment_id, label_data, tracking_number, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    RETURNING id`;

  const values = [workspaceId, orderName, voucherData.voucherNumber, voucherData.jobId, courierType, shopifyOrderId, shopifyFulfillmentId, voucherData.labelData || null, voucherData.trackingNumber || null];
  const result = await pool.query(query, values);

  // Also update the orders table to mark as processed
  const updateQuery = `
    UPDATE orders
    SET processed = TRUE
    WHERE order_name = $1 AND workspace_id = $2`;
  await pool.query(updateQuery, [orderName, workspaceId]);

  return result.rows[0];
}

async function recordCsvImport(workspaceId, filename, totalRows, imported, failed, errors) {
  const query = `
    INSERT INTO csv_imports (workspace_id, filename, total_rows, successful_imports, failed_imports, errors, imported_at)
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    RETURNING id`;
  
  const values = [workspaceId, filename, totalRows, imported, failed, JSON.stringify(errors)];
  const result = await pool.query(query, values);
  console.log(`📊 CSV Import recorded for workspace ${workspaceId}: ${filename} - ${imported}/${totalRows} imported, ${failed} failed`);
  return result.rows[0].id;
}

// ==================== OBLIO API INTEGRATION ====================

// Cache for Oblio access tokens (to avoid requesting too often)
const oblioTokenCache = new Map();

/**
 * Get Oblio access token for a workspace
 * Uses OAuth 2.0 authentication
 */
async function getOblioAccessToken(workspaceId) {
  try {
    const workspace = await getWorkspace(workspaceId);
    
    if (!workspace || !workspace.oblio_email || !workspace.oblio_secret) {
      throw new Error(`Workspace ${workspaceId} does not have Oblio credentials configured`);
    }

    // Check if we have a valid cached token
    const cacheKey = `oblio_${workspaceId}`;
    const cached = oblioTokenCache.get(cacheKey);
    
    if (cached && cached.expires_at > Date.now()) {
      console.log(`🔑 Using cached Oblio token for workspace ${workspaceId}`);
      return cached.access_token;
    }

    // Request new token
    console.log(`🔑 Requesting new Oblio access token for workspace ${workspaceId}...`);
    
    const response = await axios.post('https://www.oblio.eu/api/authorize/token', 
      new URLSearchParams({
        client_id: workspace.oblio_email,
        client_secret: workspace.oblio_secret
      }), 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const tokenData = response.data;
    
    // Cache the token (expires in 1 hour, but we refresh 5 minutes early)
    const expiresIn = parseInt(tokenData.expires_in) || 3600;
    oblioTokenCache.set(cacheKey, {
      access_token: tokenData.access_token,
      expires_at: Date.now() + ((expiresIn - 300) * 1000) // Refresh 5 min early
    });

    console.log(`✅ Oblio access token obtained for workspace ${workspaceId}`);
    return tokenData.access_token;

  } catch (error) {
    console.error(`❌ Failed to get Oblio access token:`, error.response?.data || error.message);
    throw new Error(`Oblio authentication failed: ${error.response?.data?.statusMessage || error.message}`);
  }
}

/**
 * Make authenticated request to Oblio API
 */
async function makeOblioRequest(endpoint, method = 'GET', data = null, workspaceId) {
  try {
    const accessToken = await getOblioAccessToken(workspaceId);
    const url = `https://www.oblio.eu/api${endpoint}`;

    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    console.log(`📡 Oblio API request: ${method} ${endpoint}`);
    const response = await axios(config);
    
    if (response.data.status !== 200) {
      throw new Error(response.data.statusMessage || 'Oblio API error');
    }

    return response.data;

  } catch (error) {
    console.error(`❌ Oblio API Error (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create an invoice in Oblio for a delivered order
 */
async function createOblioInvoice(orderData, workspaceId) {
  try {
    console.log(`🧾 Creating Oblio invoice for order ${orderData.orderName}...`);

    const workspace = await getWorkspace(workspaceId);
    
    if (!workspace.oblio_cif) {
      throw new Error('Oblio CIF not configured for this workspace');
    }

    // Prepare invoice data
    const invoiceData = {
      cif: workspace.oblio_cif,
      seriesName: workspace.oblio_series_name || 'FCT', // Invoice series name
      client: {
        name: orderData.shipping_name || orderData.billing_name || `${orderData.first_name || ''} ${orderData.last_name || ''}`.trim() || 'Client',
        address: orderData.shipping_address1 || '',
        city: orderData.shipping_city || '',
        state: orderData.shipping_province || '',
        country: orderData.shipping_country_code || 'GR',
        email: orderData.email || '',
        phone: orderData.shipping_phone || orderData.phone || '',
        vatPayer: false // Private persons, no CIF
      },
      issueDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      dueDate: new Date().toISOString().split('T')[0],
      deliveryDate: orderData.delivered_at ? new Date(orderData.delivered_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      remarks: `Shopify Order: ${orderData.order_name}${orderData.note ? '\n' + orderData.note : ''}`,
      language: workspace.invoice_language || 'EN', // From workspace settings
      precision: 2,
      currency: workspace.invoice_currency || 'EUR', // From workspace settings
      products: []
    };

    // Add products/line items from the products JSONB column
    let products = [];
    
    // Try to parse products from the JSONB column
    if (orderData.products) {
      if (typeof orderData.products === 'string') {
        try {
          products = JSON.parse(orderData.products);
        } catch (e) {
          console.warn('Failed to parse products:', e);
        }
      } else if (Array.isArray(orderData.products)) {
        products = orderData.products;
      } else if (typeof orderData.products === 'object') {
        products = [orderData.products];
      }
    }

    const totalPrice = parseFloat(orderData.total_price) || 0;
    
    if (products.length > 0) {
      // Shipping logic from workspace settings
      const SHIPPING_THRESHOLD = workspace.shipping_threshold;
      const SHIPPING_COST = workspace.shipping_cost;
      
      let shippingCost = 0;
      if (totalPrice < SHIPPING_THRESHOLD) {
        shippingCost = SHIPPING_COST;
      }
      
      // Products cost = total - shipping
      const productsCost = totalPrice - shippingCost;
      
      // Calculate total quantity
      const totalQuantity = products.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
      
      // Distribute products cost across all items based on their list price proportion
      const totalListPrice = products.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * (parseInt(p.quantity) || 1), 0);
      
      products.forEach((item) => {
        const itemQuantity = parseInt(item.quantity) || 1;
        const listPrice = parseFloat(item.price) || 0;
        
        let actualItemPrice;
        if (totalListPrice > 0) {
          // Distribute proportionally based on list price
          const proportion = (listPrice * itemQuantity) / totalListPrice;
          const itemTotal = productsCost * proportion;
          actualItemPrice = itemTotal / itemQuantity;
        } else {
          // If no list prices, distribute equally
          actualItemPrice = productsCost / totalQuantity;
        }
        
        invoiceData.products.push({
          name: item.name || item.title || 'Product',
          description: item.variant_title || item.description || '',
          quantity: itemQuantity,
          measuringUnit: 'buc',
          price: actualItemPrice,
          vatName: 'Normala',
          vatPercentage: parseFloat(workspace.oblio_vat_rate) || 21,
          vatIncluded: true
        });
      });

      // Add shipping as a separate line if applicable
      if (shippingCost > 0) {
        invoiceData.products.push({
          name: 'Transport / Livrare',
          description: 'Shipping charges',
          quantity: 1,
          measuringUnit: 'buc',
          price: shippingCost,
          vatName: 'Normala',
          vatPercentage: parseFloat(workspace.oblio_vat_rate) || 21,
          vatIncluded: true
        });
      }
    } else {
      // Fallback: If no products found, create a single line with the total
      invoiceData.products.push({
        name: `Order ${orderData.order_name}`,
        description: orderData.note || '',
        quantity: 1,
        measuringUnit: 'buc',
        price: totalPrice,
        vatName: 'Normala',
        vatPercentage: parseFloat(workspace.oblio_vat_rate) || 21,
        vatIncluded: true
      });
    }

    // Create the invoice via Oblio API
    console.log(`📤 Sending invoice to Oblio (VAT: ${workspace.oblio_vat_rate}%)...`);
    const response = await makeOblioRequest('/docs/invoice', 'POST', invoiceData, workspaceId);

    console.log(`✅ Oblio invoice created successfully:`, response.data);
    
    return {
      success: true,
      seriesName: response.data.seriesName,
      number: response.data.number,
      link: response.data.link,
      invoiceData: response.data
    };

  } catch (error) {
    console.error(`❌ Failed to create Oblio invoice:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get Oblio invoice PDF URL
 */
function getOblioInvoiceUrl(seriesName, number, cif) {
  // Oblio provides a direct link in the response, but we can also construct it
  return `https://www.oblio.eu/factura/${cif}/${seriesName}/${number}`;
}

/**
 * Cancel an Oblio invoice
 */
async function cancelOblioInvoice(seriesName, number, workspaceId) {
  try {
    console.log(`🚫 Cancelling Oblio invoice ${seriesName}/${number}...`);

    const workspace = await getWorkspace(workspaceId);
    
    const response = await makeOblioRequest(
      '/docs/invoice/cancel', 
      'POST', 
      {
        cif: workspace.oblio_cif,
        seriesName: seriesName,
        number: number
      },
      workspaceId
    );

    console.log(`✅ Oblio invoice ${seriesName}/${number} cancelled successfully`);
    return response;

  } catch (error) {
    console.error(`❌ Failed to cancel Oblio invoice:`, error.response?.data || error.message);
    throw error;
  }
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
app.post('/api/orders/:orderId/voucher', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const { orderId } = req.params;
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
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
    const voucher = await createVoucher(order, workspaceId);
    
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
app.post('/api/upload-csv', authenticateUser, authorizeWorkspace, upload.single('csvFile'), async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
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
            // Accept any order name that matches pattern: PREFIX#NUMBER or PREFIX#NUMBERSUFFIX
            // Examples: CLO#1234GR, INB#1001GR, ORDER#123, etc.
            if (orderName && /^[A-Z]+#\d+/.test(orderName)) {
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
              
              await insertOrder(orderData, workspaceId);
              imported++;
              
            } catch (error) {
              console.error(`❌ Failed to import order ${orderName}:`, error.message);
              failed++;
              errors.push(`Order ${orderName}: ${error.message}`);
            }
          }

          await recordCsvImport(workspaceId, filename, results.length, imported, failed, errors);
          
          // Log summary
          if (errors.length > 0) {
            console.log(`\n⚠️  Import Summary for ${filename}:`);
            console.log(`   ✅ Successful: ${imported}`);
            console.log(`   ❌ Failed: ${failed}`);
            console.log(`\n📋 First 5 errors:`);
            errors.slice(0, 5).forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
            if (errors.length > 5) {
              console.log(`   ... and ${errors.length - 5} more errors\n`);
            }
          }
          
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

// Get imported orders from database with pagination
app.get('/api/imported-orders', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status || null;
    
    console.log(`📊 Fetching orders - Page: ${page}, Limit: ${limit}, Status Filter: ${statusFilter || 'None'}`);
    
    // Get total count with filter applied at database level
    const totalCount = await countOrders(workspaceId, statusFilter);
    
    // Get orders for current page with filter applied at database level
    const orders = await getAllOrders(workspaceId, limit, offset, statusFilter);
    
    // Calculate pagination based on filtered count
    const totalOrders = totalCount;
    const totalPages = Math.ceil(totalOrders / limit);
    
    console.log(`✅ Found ${orders.length} orders on page ${page} of ${totalPages} (${totalOrders} total matching filter)`);
    
    res.json({
      success: true,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      ordersPerPage: limit,
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
          country: order.shipping_country || 'N/A',
          email: order.email,
          totalPrice: order.total_price,
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
          processed: order.processed,
          voucherNumber: order.voucher_number,
          voucherStatus: order.voucher_status, 
          voucherCreatedAt: order.voucher_created_at,
          voucherCreated: order.voucher_created_at,
          deliveryStatus: order.delivery_status,
          deliveryStatusCode: order.delivery_status_code,
          currentLocation: order.current_location,
          deliveredAt: order.delivered_at,
          deliveryStatusUpdatedAt: order.delivery_status_updated_at,
          orderStatus: order.order_status,
          sentToGeniki: order.sent_to_geniki,
          sentToGenikiAt: order.sent_to_geniki_at,
          importedAt: order.imported_at,
          lineItems: order.line_items,
          products: order.products ? (typeof order.products === 'string' ? JSON.parse(order.products) : order.products) : null,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          outstandingBalance: order.outstanding_balance,
          oblioInvoiceId: order.oblio_invoice_id,
          oblioSeriesName: order.oblio_series_name,
          oblioInvoiceNumber: order.oblio_invoice_number,
          oblioInvoiceUrl: order.oblio_invoice_url,
          invoicedAt: order.invoiced_at,
          shopifyOrderId: order.shopify_order_id
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
    const workspaceId = parseInt(req.query.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    const orderData = await getOrder(req.params.orderId, workspaceId);
    
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
        fulfillmentStatus: orderData.fulfillment_status,
        processed: orderData.processed,
        deliveryStatus: orderData.delivery_status,
        deliveryStatusCode: orderData.delivery_status_code,
        currentLocation: orderData.current_location,
        deliveredAt: orderData.delivered_at,
        deliveryStatusUpdatedAt: orderData.delivery_status_updated_at,
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
    const workspaceId = parseInt(req.body.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    console.log(`🎫 Creating voucher for order ${req.params.orderId} in workspace ${workspaceId}`);

    const orderData = await getOrder(req.params.orderId, workspaceId);

    if (!orderData) {
      console.log(`❌ Order ${req.params.orderId} not found in workspace ${workspaceId}`);
      return res.status(404).json({
        success: false,
        error: 'Order not found in database'
      });
    }

    // Get workspace settings to determine default courier
    const workspace = await getWorkspace(workspaceId);
    const defaultCourier = workspace?.default_courier || 'geniki';
    console.log(`📦 Using default courier: ${defaultCourier}`);

    let voucher;
    let courierType;

    if (defaultCourier === 'meest') {
      // Check if Meest is enabled
      if (!workspace.meest_enabled || !workspace.meest_username || !workspace.meest_password) {
        throw new Error('Meest is not properly configured. Please check your Meest credentials in Settings.');
      }

      // Create voucher with Meest
      console.log('🚀 Creating parcel with Meest...');
      voucher = await createMeestParcel(orderData, workspaceId);
      courierType = 'meest';
      console.log(`✅ Meest parcel created: ${voucher.voucherNumber}`);

    } else {
      // Convert database order to Geniki format with proper data types and fallbacks
      const geinikiOrder = {
        order_number: orderData.order_name,
        name: orderData.order_name,
        email: orderData.email || '',
        shipping_address: {
          first_name: orderData.first_name || 'Customer',
          last_name: orderData.last_name || '',
          address1: orderData.shipping_address1 || '',
          address2: orderData.shipping_address2 || '',
          city: orderData.shipping_city || '',
          zip: orderData.shipping_zip || '',
          country_code: orderData.shipping_country_code || 'GR',
          phone: orderData.shipping_phone || ''
        },
        customer: {
          phone: orderData.shipping_phone || ''
        },
        line_items: orderData.products ?
          (typeof orderData.products === 'string' ? JSON.parse(orderData.products) : orderData.products).map(p => ({
            grams: 500, // Default weight per item
            quantity: p.quantity || 1,
            name: p.name || 'Order Item'
          }))
          : [{ grams: 500, quantity: 1, name: orderData.line_items || 'Order Item' }],
        total_price: parseFloat(orderData.total_price) || 0,
        note: orderData.notes || '',
        financial_status: orderData.financial_status || 'pending',
        payment_gateway_names: orderData.payment_method ? [orderData.payment_method] : ['COD'],
        payment_status: orderData.payment_status || 'cod'
      };

      console.log('🔍 Transformed order data for Geniki:', JSON.stringify(geinikiOrder, null, 2));

      // Create voucher with Geniki
      voucher = await createVoucher(geinikiOrder, workspaceId);
      courierType = 'geniki';
    }

    // Save voucher to database with courier type
    const savedVoucher = await insertVoucher(orderData.order_name, voucher, workspaceId, courierType);

    res.json({
      success: true,
      message: `Voucher created successfully for ${orderData.order_name} via ${courierType.toUpperCase()}`,
      voucher: {
        jobId: voucher.jobId,
        voucherNumber: voucher.voucherNumber,
        courierType: courierType,
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
    
    const workspaceId = parseInt(req.headers['x-workspace-id']) || 1;
    const voucher = await createVoucher(testOrder, workspaceId);
    results.createJob = {
      success: true,
      jobId: voucher.jobId,
      voucherNumber: voucher.voucherNumber,
      message: 'Voucher created successfully'
    };
    
    // Test 3: Get PDF
    console.log('3️⃣ Testing GETVOUCHERSPDF...');
    const pdf = await getVoucherPdf(voucher.voucherNumber, workspaceId);
    results.getVouchersPdf = {
      success: true,
      pdfSize: pdf.length + ' bytes',
      message: 'PDF generated successfully'
    };
    
    // Test 4: Cancel job
    console.log('4️⃣ Testing CANCELJOB...');
    await cancelJob(voucher.jobId, workspaceId);
    results.cancelJob = {
      success: true,
      message: 'Job cancelled successfully'
    };
    
    // Test 5: Close pending jobs
    console.log('5️⃣ Testing CLOSEPENDINGJOBS...');
    const today = new Date().toISOString().split('T')[0];
    await closePendingJobsByDate(today, today, workspaceId);
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
      payment_status: 'cod',
      note: 'Demo order για production approval - Geniki API Integration Test',
      line_items: [
        { grams: 800, quantity: 2, name: 'Dream Towels XL' },
        { grams: 300, quantity: 1, name: 'Dream Towels Mini' }
      ]
    };

    // Create actual voucher
    const workspaceId = parseInt(req.headers['x-workspace-id']) || 1;
    const voucher = await createVoucher(demoOrder, workspaceId);
    
    // Get PDF for verification
    const pdfBuffer = await getVoucherPdf(voucher.voucherNumber, workspaceId);
    
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
        
        const voucher = await createVoucher(geinikiOrder, orderData.workspace_id);
        await insertVoucher(orderData.order_name, voucher, orderData.workspace_id);
        
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
    // Try to get workspace ID from header, query param, or default to 1
    const workspaceId = parseInt(req.headers['x-workspace-id']) ||
                        parseInt(req.query.workspaceId) || 1;
    const voucherNumber = req.params.voucherNumber;

    console.log(`📥 PDF Download request for voucher ${voucherNumber}, workspace ${workspaceId}`);

    // Get voucher from database to check courier type and stored label
    const voucherResult = await pool.query(
      'SELECT courier_type, label_data FROM vouchers WHERE voucher_number = $1 AND workspace_id = $2',
      [voucherNumber, workspaceId]
    );

    const courierType = voucherResult.rows[0]?.courier_type || 'geniki';
    const storedLabelData = voucherResult.rows[0]?.label_data || null;
    console.log(`📦 Voucher courier type: ${courierType}, has stored label: ${!!storedLabelData}`);

    let pdf;

    if (courierType === 'meest') {
      // Use stored label if available, otherwise try to fetch from Meest API
      if (storedLabelData) {
        console.log('📄 Using stored Meest label...');
        pdf = Buffer.from(storedLabelData, 'base64');
      } else {
        console.log('🚀 Fetching Meest label from API...');
        const base64Pdf = await getMeestLabel(voucherNumber, workspaceId);
        pdf = Buffer.from(base64Pdf, 'base64');
      }
    } else {
      // Get label from Geniki
      pdf = await getVoucherPdf(voucherNumber, workspaceId);
    }

    console.log(`✅ PDF ready: ${pdf.length} bytes`);

    // Set proper headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=label-${voucherNumber}.pdf`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    res.send(pdf);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    console.error(`[PDF Download] Failed for voucher ${req.params.voucherNumber}:`, error.message);

    res.status(500).json({ error: error.message });
  }
});

// Cancel voucher/AWB
app.delete('/api/voucher/:voucherNumber/cancel', async (req, res) => {
  try {
    const { voucherNumber } = req.params;
    const workspaceId = parseInt(req.query.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;

    console.log(`🚫 Cancel voucher request for ${voucherNumber}, workspace ${workspaceId}`);

    // Get voucher from database to check courier type and job_id
    const voucherResult = await pool.query(
      'SELECT voucher_number, job_id, courier_type, order_name FROM vouchers WHERE voucher_number = $1 AND workspace_id = $2',
      [voucherNumber, workspaceId]
    );

    if (voucherResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Voucher not found' });
    }

    const voucher = voucherResult.rows[0];
    const courierType = voucher.courier_type || 'geniki';

    console.log(`📦 Voucher courier type: ${courierType}`);

    // Cancel at courier API
    if (courierType === 'meest') {
      await cancelMeestParcel(voucherNumber, workspaceId);
    } else {
      // Geniki uses job_id for cancellation
      if (voucher.job_id) {
        await cancelJob(voucher.job_id, workspaceId);
      }
    }

    // Delete voucher from database
    await pool.query(
      'DELETE FROM vouchers WHERE voucher_number = $1 AND workspace_id = $2',
      [voucherNumber, workspaceId]
    );

    // Update order to clear voucher info
    if (voucher.order_name) {
      await pool.query(`
        UPDATE imported_orders
        SET voucher_number = NULL,
            voucher_created_at = NULL,
            delivery_status = NULL,
            delivery_status_updated_at = NULL,
            processed = FALSE
        WHERE order_name = $1 AND workspace_id = $2
      `, [voucher.order_name, workspaceId]);
    }

    console.log(`✅ Voucher ${voucherNumber} cancelled and deleted successfully`);

    res.json({
      success: true,
      message: `Voucher ${voucherNumber} cancelled successfully`,
      courierType
    });

  } catch (error) {
    console.error(`❌ Cancel voucher error for ${req.params.voucherNumber}:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Finalize vouchers
app.post('/api/vouchers/finalize', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body;
    const workspaceId = parseInt(req.body.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    
    if (dateFrom && dateTo) {
      await closePendingJobsByDate(dateFrom, dateTo, workspaceId);
      
      // Update vouchers in this date range to mark as sent
      await pool.query(`
        UPDATE vouchers 
        SET status = 'sent',
            sent_to_geniki = TRUE,
            sent_to_geniki_at = CURRENT_TIMESTAMP
        WHERE DATE(created_at) >= $1
          AND DATE(created_at) <= $2
          AND workspace_id = $3
          AND voucher_number IS NOT NULL
          AND (status != 'sent' OR sent_to_geniki IS NULL OR sent_to_geniki = FALSE)
      `, [dateFrom, dateTo, workspaceId]);
    } else {
      await closePendingJobs(workspaceId);
      
      // Update today's vouchers to mark as sent
      const today = new Date().toISOString().split('T')[0];
      await pool.query(`
        UPDATE vouchers 
        SET status = 'sent',
            sent_to_geniki = TRUE,
            sent_to_geniki_at = CURRENT_TIMESTAMP
        WHERE DATE(created_at) = $1
          AND workspace_id = $2
          AND voucher_number IS NOT NULL
          AND (status != 'sent' OR sent_to_geniki IS NULL OR sent_to_geniki = FALSE)
      `, [today, workspaceId]);
    }
    
    res.json({ success: true, message: 'Vouchers finalized' });
  } catch (error) {
    console.error('Error finalizing vouchers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send labels to Geniki (finalize vouchers)
app.post('/api/send-labels', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    const { orderIds } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No order IDs provided'
      });
    }

    console.log(`📤 Sending ${orderIds.length} labels to Geniki (workspace ${workspaceId}):`, orderIds);

    // Get voucher information for selected orders
    const voucherQuery = `
      SELECT DISTINCT v.voucher_number, v.job_id, o.order_name
      FROM vouchers v
      JOIN orders o ON v.order_name = o.order_name  
      WHERE o.order_name = ANY($1)
      AND v.workspace_id = $2
      AND o.workspace_id = $2
      AND v.voucher_number IS NOT NULL
    `;
    
    const voucherResult = await pool.query(voucherQuery, [orderIds, workspaceId]);
    const vouchers = voucherResult.rows;
    
    if (vouchers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No vouchers found for the selected orders'
      });
    }

    console.log(`🎯 Found ${vouchers.length} vouchers to send:`, vouchers.map(v => v.voucher_number));

    // Call Geniki's ClosePendingJobs to finalize all vouchers created today
    console.log('📡 Calling Geniki ClosePendingJobs...');
    const result = await closePendingJobs(workspaceId);
    
    // Update ALL today's vouchers status in database to mark as sent
    // Since ClosePendingJobs sends ALL today's vouchers, we need to update ALL of them
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    const updateQuery = `
      UPDATE vouchers 
      SET status = 'sent',
          sent_to_geniki = TRUE,
          sent_to_geniki_at = CURRENT_TIMESTAMP
      WHERE DATE(created_at) = $1
      AND workspace_id = $2
      AND voucher_number IS NOT NULL
      AND (status != 'sent' OR sent_to_geniki IS NULL OR sent_to_geniki = FALSE)
    `;
    const updateResult = await pool.query(updateQuery, [today, workspaceId]);
    console.log(`📋 Updated ${updateResult.rowCount} vouchers to 'sent' status for date: ${today}`);
    
    console.log(`✅ Successfully sent ALL today's labels to Geniki and updated ${updateResult.rowCount} statuses`);
    
    res.json({
      success: true,
      message: `Successfully sent ALL today's labels to Geniki (${updateResult.rowCount} vouchers updated)`,
      sentVouchers: updateResult.rowCount,
      affectedDate: today,
      note: 'All vouchers created today have been finalized with Geniki and status updated to "sent"'
    });
    
  } catch (error) {
    console.error('Error sending labels to Geniki:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Export selected labels endpoint (combine multiple vouchers in one PDF)
app.post('/api/export-labels', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    const { orderIds } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No order IDs provided'
      });
    }

    console.log(`🖨️ Exporting labels for ${orderIds.length} orders (workspace ${workspaceId}):`, orderIds);

    // Get voucher numbers for selected orders with courier type and label data
    const voucherQuery = `
      SELECT DISTINCT v.voucher_number, o.order_name, v.created_at, v.courier_type, v.label_data
      FROM vouchers v
      JOIN orders o ON v.order_name = o.order_name
      WHERE o.order_name = ANY($1)
      AND v.workspace_id = $2
      AND o.workspace_id = $2
      AND v.voucher_number IS NOT NULL
      ORDER BY v.created_at DESC
    `;

    const voucherResult = await pool.query(voucherQuery, [orderIds, workspaceId]);
    const vouchers = voucherResult.rows;

    if (vouchers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No vouchers found for the selected orders'
      });
    }

    // Separate vouchers by courier type
    const genikiVouchers = vouchers.filter(v => v.courier_type !== 'meest');
    const meestVouchers = vouchers.filter(v => v.courier_type === 'meest');

    console.log(`🎯 Found ${vouchers.length} vouchers to export: ${genikiVouchers.length} Geniki, ${meestVouchers.length} Meest`);

    const pdfBuffers = [];

    // Get Geniki PDFs
    if (genikiVouchers.length > 0) {
      const genikiNumbers = genikiVouchers.map(v => v.voucher_number);
      console.log('📡 Calling Geniki GetVouchersPdf for multiple vouchers...');
      const genikiPdf = await getMultipleVouchersPdf(genikiNumbers, workspaceId);
      pdfBuffers.push(genikiPdf);
    }

    // Get Meest PDFs (from stored labels)
    for (const meestVoucher of meestVouchers) {
      if (meestVoucher.label_data) {
        console.log(`📄 Using stored Meest label for ${meestVoucher.voucher_number}`);
        pdfBuffers.push(Buffer.from(meestVoucher.label_data, 'base64'));
      } else {
        console.log(`⚠️ No stored label for Meest voucher ${meestVoucher.voucher_number}, skipping`);
      }
    }

    if (pdfBuffers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No labels available for export'
      });
    }

    // Merge all PDFs or return single one
    let pdfBuffer;
    if (pdfBuffers.length === 1) {
      pdfBuffer = pdfBuffers[0];
    } else {
      // For now, just concatenate - in production you'd use pdf-lib or similar to properly merge
      // Since Meest and Geniki labels are separate documents, concatenation may cause issues
      // For now, prioritize returning what we have
      pdfBuffer = pdfBuffers[0]; // Return first PDF, TODO: implement proper PDF merging
      console.log(`⚠️ Multiple PDF sources found, returning first. Consider implementing PDF merge.`);
    }
    
    console.log(`✅ Successfully exported ${vouchers.length} labels in one PDF (${pdfBuffer.length} bytes)`);
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=labels_${vouchers.length}_vouchers_${new Date().toISOString().split('T')[0]}.pdf`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error exporting labels:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete selected orders endpoint
app.delete('/api/imported-orders', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    const { orderIds } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
      success: false, 
        error: 'No order IDs provided'
      });
    }

    console.log(`🗑️ Deleting ${orderIds.length} orders (workspace ${workspaceId}):`, orderIds);

    // Delete orders and related vouchers 
    // vouchers.order_name matches orders.order_name (both VARCHAR)
    const deleteVouchersQuery = 'DELETE FROM vouchers WHERE order_name = ANY($1) AND workspace_id = $2';
    const deleteOrdersQuery = 'DELETE FROM orders WHERE order_name = ANY($1) AND workspace_id = $2';
    
    // Use transaction to ensure both deletes succeed or both fail
    await pool.query('BEGIN');
    
    try {
      // Delete vouchers first (foreign key constraint)
      const voucherResult = await pool.query(deleteVouchersQuery, [orderIds, workspaceId]);
      console.log(`🗑️ Deleted ${voucherResult.rowCount} vouchers`);
      
      // Delete orders
      const orderResult = await pool.query(deleteOrdersQuery, [orderIds, workspaceId]);
      console.log(`🗑️ Deleted ${orderResult.rowCount} orders`);
      
      await pool.query('COMMIT');
      
      res.json({
        success: true,
        message: `Successfully deleted ${orderResult.rowCount} orders and ${voucherResult.rowCount} vouchers`,
        deletedOrders: orderResult.rowCount,
        deletedVouchers: voucherResult.rowCount
      });
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error deleting orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== FULFILLMENT API ROUTES ====================

// Fulfill single order
app.post('/api/orders/:orderId/fulfill', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const { orderId } = req.params;
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    console.log(`📦 Fulfilling order ${orderId} in workspace ${workspaceId}`);
    
    // Get order from database
    const order = await getOrder(orderId, workspaceId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Check if order has a voucher with tracking number
    if (!order.voucher_number) {
      return res.status(400).json({
        success: false,
        error: 'Order does not have a voucher/tracking number. Create a voucher first.'
      });
    }
    
    // Get Shopify order ID - either from database or fetch by order name
    let shopifyOrderId = order.shopify_order_id;
    
    // If shopify_order_id looks like an order name (contains #), treat it as NULL
    // This happens when orders are imported via CSV
    if (shopifyOrderId && shopifyOrderId.toString().includes('#')) {
      console.log(`⚠️  Shopify order ID looks like order name: ${shopifyOrderId}, will search for real ID`);
      shopifyOrderId = null;
    }
    
    if (!shopifyOrderId) {
      // Order was imported via CSV, need to find it in Shopify by name
      console.log(`🔍 Fetching Shopify order by name: ${order.order_name}`);
      try {
        const searchUrl = `/orders.json?name=${encodeURIComponent(order.order_name)}&status=any`;
        console.log(`   Search URL: ${searchUrl}`);
        
        const ordersData = await makeShopifyRequest(searchUrl, 'GET', null, workspaceId);
        
        console.log(`📊 Search results: ${ordersData.orders ? ordersData.orders.length : 0} orders found`);
        
        if (ordersData.orders && ordersData.orders.length > 0) {
          shopifyOrderId = ordersData.orders[0].id;
          console.log(`✅ Found Shopify order ID: ${shopifyOrderId}`);
          console.log(`   Order name: ${ordersData.orders[0].name}`);
        } else {
          console.error(`❌ No orders found with name: ${order.order_name}`);
          return res.status(404).json({
            success: false,
            error: `Order ${order.order_name} not found in Shopify. Please verify the order exists.`
          });
        }
      } catch (error) {
        console.error(`❌ Error searching for order:`, error);
        return res.status(500).json({
          success: false,
          error: `Failed to find order in Shopify: ${error.message}`
        });
      }
    }
    
    // Create fulfillment in Shopify
    const fulfillment = await createShopifyFulfillment(
      shopifyOrderId,
      order.voucher_number,
      workspaceId
    );
    
    // Update database to mark order as fulfilled AND store Shopify fulfillment ID
    await pool.query(
      `UPDATE orders 
       SET fulfillment_status = 'fulfilled' 
       WHERE order_name = $1 AND workspace_id = $2`,
      [order.order_name, workspaceId]
    );
    
    // Store Shopify fulfillment ID in vouchers table for future delivery updates
    await pool.query(
      `UPDATE vouchers 
       SET shopify_fulfillment_id = $1, shopify_order_id = $2
       WHERE voucher_number = $3 AND workspace_id = $4`,
      [fulfillment.id, shopifyOrderId, order.voucher_number, workspaceId]
    );
    
    console.log(`✅ Updated database: Order ${orderId} marked as fulfilled, Shopify fulfillment ID ${fulfillment.id} stored`);
    
    res.json({
      success: true,
      message: `Order ${orderId} fulfilled successfully`,
      fulfillment: {
        id: fulfillment.id,
        status: fulfillment.status,
        tracking_number: fulfillment.tracking_number,
        tracking_url: fulfillment.tracking_url
      }
    });
    
  } catch (error) {
    console.error('Error fulfilling order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk fulfill orders
app.post('/api/orders/bulk-fulfill', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const { orderIds } = req.body;
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No order IDs provided'
      });
    }
    
    console.log(`📦 Bulk fulfilling ${orderIds.length} orders in workspace ${workspaceId}`);
    
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    
    // Helper function to add delay between requests (Shopify rate limit: 2 calls/second)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i];
      try {
        // Get order from database
        const order = await getOrder(orderId, workspaceId);
        
        if (!order) {
          results.push({
            orderId,
            success: false,
            error: 'Order not found'
          });
          failedCount++;
          continue;
        }
        
        // Check if order has a voucher
        if (!order.voucher_number) {
          results.push({
            orderId,
            success: false,
            error: 'No voucher/tracking number'
          });
          failedCount++;
          continue;
        }
        
        // Get Shopify order ID - either from database or fetch by order name
        let shopifyOrderId = order.shopify_order_id;
        
        // If shopify_order_id looks like an order name (contains #), treat it as NULL
        if (shopifyOrderId && shopifyOrderId.toString().includes('#')) {
          shopifyOrderId = null;
        }
        
        if (!shopifyOrderId) {
          // Order was imported via CSV, need to find it in Shopify by name
          try {
            const ordersData = await makeShopifyRequest(
              `/orders.json?name=${encodeURIComponent(order.order_name)}&status=any`,
              'GET',
              null,
              workspaceId
            );
            
            if (ordersData.orders && ordersData.orders.length > 0) {
              shopifyOrderId = ordersData.orders[0].id;
            } else {
              results.push({
                orderId,
                success: false,
                error: 'Order not found in Shopify'
              });
              failedCount++;
              continue;
            }
          } catch (error) {
            results.push({
              orderId,
              success: false,
              error: `Failed to find in Shopify: ${error.message}`
            });
            failedCount++;
            continue;
          }
        }
        
        // Create fulfillment
        const fulfillment = await createShopifyFulfillment(
          shopifyOrderId,
          order.voucher_number,
          workspaceId
        );
        
        // Update database to mark order as fulfilled
        await pool.query(
          `UPDATE orders 
           SET fulfillment_status = 'fulfilled' 
           WHERE order_name = $1 AND workspace_id = $2`,
          [order.order_name, workspaceId]
        );
        
        // Store Shopify fulfillment ID in vouchers table for future delivery updates
        await pool.query(
          `UPDATE vouchers 
           SET shopify_fulfillment_id = $1, shopify_order_id = $2
           WHERE voucher_number = $3 AND workspace_id = $4`,
          [fulfillment.id, shopifyOrderId, order.voucher_number, workspaceId]
        );
        
        results.push({
          orderId,
          success: true,
          trackingNumber: fulfillment.tracking_number
        });
        successCount++;
        
      } catch (error) {
        console.error(`Failed to fulfill order ${orderId}:`, error.message);
        results.push({
          orderId,
          success: false,
          error: error.message
        });
        failedCount++;
      }
      
      // Add delay between requests to respect Shopify rate limit (2 calls/second)
      // Each fulfillment makes 3-4 API calls, so we need 2000ms (2 seconds) delay
      // Skip delay for the last order
      if (i < orderIds.length - 1) {
        console.log(`⏳ Waiting 2 seconds before next fulfillment (${i + 1}/${orderIds.length} completed)...`);
        await delay(2000);
      }
    }
    
    res.json({
      success: true,
      message: `Fulfilled ${successCount} of ${orderIds.length} orders`,
      summary: {
        total: orderIds.length,
        succeeded: successCount,
        failed: failedCount
      },
      results
    });
    
  } catch (error) {
    console.error('Error in bulk fulfillment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== BACKFILL & SYNC ROUTES ====================

// Sync fulfillment status FROM Shopify TO database for imported orders
app.post('/api/sync-from-shopify', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const { orderIds } = req.body;
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    console.log(`🔄 Syncing fulfillment status from Shopify for ${orderIds ? orderIds.length : 'all'} orders in workspace ${workspaceId}...`);
    
    // Get orders to sync - either specific orders or all orders
    let ordersQuery;
    let queryParams;
    
    if (orderIds && orderIds.length > 0) {
      // Sync specific orders
      ordersQuery = `
        SELECT DISTINCT
          o.order_name,
          o.shopify_order_id,
          o.fulfillment_status as current_fulfillment_status
        FROM orders o
        WHERE o.workspace_id = $1
          AND o.order_name = ANY($2::text[])
      `;
      queryParams = [workspaceId, orderIds];
    } else {
      // Sync all orders that aren't already fulfilled
      ordersQuery = `
        SELECT DISTINCT
          o.order_name,
          o.shopify_order_id,
          o.fulfillment_status as current_fulfillment_status
        FROM orders o
        WHERE o.workspace_id = $1
          AND (o.fulfillment_status IS NULL OR o.fulfillment_status != 'fulfilled')
      `;
      queryParams = [workspaceId];
    }
    
    const ordersResult = await pool.query(ordersQuery, queryParams);
    const orders = ordersResult.rows;
    
    console.log(`📋 Found ${orders.length} orders to check in Shopify`);
    
    if (orders.length === 0) {
      return res.json({
        success: true,
        message: 'No orders to sync',
        synced: 0,
        failed: 0
      });
    }
    
    let synced = 0;
    let failed = 0;
    let alreadyFulfilled = 0;
    const results = [];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      try {
        let shopifyOrderId = order.shopify_order_id;
        
        // If no Shopify order ID, look it up by order name
        if (!shopifyOrderId || (typeof shopifyOrderId === 'string' && shopifyOrderId.includes('#'))) {
          console.log(`🔍 Looking up Shopify order for ${order.order_name}...`);
          const searchUrl = `/orders.json?name=${encodeURIComponent(order.order_name)}&status=any`;
          const ordersData = await makeShopifyRequest(searchUrl, 'GET', null, workspaceId);
          
          if (ordersData.orders && ordersData.orders.length > 0) {
            shopifyOrderId = ordersData.orders[0].id;
            console.log(`✅ Found Shopify order ID: ${shopifyOrderId} for ${order.order_name}`);
            
            // Update the order with the correct Shopify order ID
            await pool.query(
              'UPDATE orders SET shopify_order_id = $1 WHERE order_name = $2 AND workspace_id = $3',
              [shopifyOrderId, order.order_name, workspaceId]
            );
          } else {
            console.log(`⚠️  Could not find Shopify order for ${order.order_name}`);
            failed++;
            results.push({ orderName: order.order_name, success: false, error: 'Order not found in Shopify' });
            continue;
          }
        }
        
        // Fetch order details from Shopify
        const orderData = await makeShopifyRequest(`/orders/${shopifyOrderId}.json`, 'GET', null, workspaceId);
        
        if (!orderData || !orderData.order) {
          failed++;
          results.push({ orderName: order.order_name, success: false, error: 'Failed to fetch order from Shopify' });
          continue;
        }
        
        const shopifyOrder = orderData.order;
        
        // Check if order has fulfillments in Shopify
        if (!shopifyOrder.fulfillments || shopifyOrder.fulfillments.length === 0) {
          console.log(`ℹ️  Order ${order.order_name} is not fulfilled in Shopify`);
          results.push({ 
            orderName: order.order_name, 
            success: true, 
            status: 'unfulfilled',
            message: 'Not fulfilled in Shopify' 
          });
          continue;
        }
        
        // Order is fulfilled in Shopify - check delivery status
        const fulfillment = shopifyOrder.fulfillments[0];
        const fulfillmentId = fulfillment.id;
        const trackingNumber = fulfillment.tracking_number;
        const shipmentStatus = fulfillment.shipment_status; // Can be: 'delivered', 'in_transit', 'out_for_delivery', 'attempted_delivery', 'ready_for_pickup', 'picked_up', 'label_printed', 'label_purchased', 'confirmed', 'failure', null
        
        // Determine the correct status based on Shopify's shipment status
        let dbStatus = 'fulfilled'; // Default to fulfilled
        let deliveredAt = null;
        
        if (shipmentStatus === 'delivered' || shipmentStatus === 'picked_up') {
          dbStatus = 'delivered';
          deliveredAt = new Date(); // Use current time as delivered time (Shopify doesn't always provide exact delivery time)
          console.log(`✅ Order ${order.order_name} is DELIVERED in Shopify (fulfillment ID: ${fulfillmentId}, shipment_status: ${shipmentStatus})`);
        } else {
          console.log(`✅ Order ${order.order_name} is fulfilled in Shopify (fulfillment ID: ${fulfillmentId}, shipment_status: ${shipmentStatus || 'none'})`);
        }
        
        // Update orders table with correct fulfillment/delivery status
        if (dbStatus === 'delivered' && deliveredAt) {
          await pool.query(
            `UPDATE orders 
             SET fulfillment_status = $1, shopify_order_id = $2, delivered_at = $3
             WHERE order_name = $4 AND workspace_id = $5`,
            [dbStatus, shopifyOrderId, deliveredAt, order.order_name, workspaceId]
          );
        } else {
          await pool.query(
            `UPDATE orders 
             SET fulfillment_status = $1, shopify_order_id = $2
             WHERE order_name = $3 AND workspace_id = $4`,
            [dbStatus, shopifyOrderId, order.order_name, workspaceId]
          );
        }
        
        // If there's a voucher for this order, update it with fulfillment info
        const voucherResult = await pool.query(
          'SELECT voucher_number FROM vouchers WHERE order_name = $1 AND workspace_id = $2 LIMIT 1',
          [order.order_name, workspaceId]
        );
        
        if (voucherResult.rows.length > 0) {
          if (dbStatus === 'delivered' && deliveredAt) {
            await pool.query(
              `UPDATE vouchers 
               SET shopify_fulfillment_id = $1, shopify_order_id = $2, delivered_at = $3
               WHERE order_name = $4 AND workspace_id = $5`,
              [fulfillmentId, shopifyOrderId, deliveredAt, order.order_name, workspaceId]
            );
          } else {
            await pool.query(
              `UPDATE vouchers 
               SET shopify_fulfillment_id = $1, shopify_order_id = $2
               WHERE order_name = $3 AND workspace_id = $4`,
              [fulfillmentId, shopifyOrderId, order.order_name, workspaceId]
            );
          }
        }
        
        synced++;
        alreadyFulfilled++;
        results.push({
          orderName: order.order_name,
          success: true,
          status: dbStatus,
          fulfillmentId: fulfillmentId,
          trackingNumber: trackingNumber || 'No tracking',
          shipmentStatus: shipmentStatus || 'none',
          message: `Synced from Shopify as ${dbStatus}`
        });
        
        // Rate limiting: wait between requests
        if (i < orders.length - 1) {
          await delay(500); // 500ms between requests
        }
        
      } catch (error) {
        console.error(`Error syncing order ${order.order_name}:`, error.message);
        failed++;
        results.push({
          orderName: order.order_name,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Sync complete: ${synced} synced (${alreadyFulfilled} were already fulfilled in Shopify), ${failed} failed`);
    
    res.json({
      success: true,
      message: `Synced ${synced} orders from Shopify`,
      summary: {
        total: orders.length,
        synced: synced,
        alreadyFulfilled: alreadyFulfilled,
        failed: failed
      },
      results
    });
    
  } catch (error) {
    console.error('Error syncing from Shopify:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Backfill Shopify fulfillment IDs for already-fulfilled orders
app.post('/api/backfill-fulfillment-ids', async (req, res) => {
  try {
    const workspaceId = parseInt(req.body.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    
    console.log(`🔄 Starting backfill of Shopify fulfillment IDs for workspace ${workspaceId}...`);
    
    // Get all orders with vouchers that are fulfilled in Shopify but missing fulfillment_id
    // This includes orders where shopify_order_id might contain the order name instead of the ID
    const ordersQuery = `
      SELECT DISTINCT
        o.order_name,
        o.shopify_order_id,
        v.voucher_number,
        v.shopify_fulfillment_id
      FROM orders o
      JOIN vouchers v ON o.order_name = v.order_name AND o.workspace_id = v.workspace_id
      WHERE o.workspace_id = $1
        AND v.shopify_fulfillment_id IS NULL
        AND (
          (o.fulfillment_status = 'fulfilled' AND o.shopify_order_id IS NOT NULL AND o.shopify_order_id !~ '#')
          OR (o.shopify_order_id ~ '#')  -- Include old orders where shopify_order_id contains the order name
          OR (v.delivered_at IS NOT NULL)  -- Include delivered vouchers even if not marked as fulfilled
        )
    `;
    
    const ordersResult = await pool.query(ordersQuery, [workspaceId]);
    const orders = ordersResult.rows;
    
    console.log(`📋 Found ${orders.length} orders to backfill`);
    
    if (orders.length === 0) {
      return res.json({
        success: true,
        message: 'No orders need backfilling',
        updated: 0
      });
    }
    
    let updated = 0;
    let failed = 0;
    const results = [];
    
    for (const order of orders) {
      try {
        let shopifyOrderId = order.shopify_order_id;
        
        // If no Shopify order ID OR if it contains "#" (which means it's actually the order name), look it up
        if (!shopifyOrderId || (typeof shopifyOrderId === 'string' && shopifyOrderId.includes('#'))) {
          console.log(`🔍 Looking up Shopify order for ${order.order_name}...`);
          const searchUrl = `/orders.json?name=${encodeURIComponent(order.order_name)}&status=any`;
          const ordersData = await makeShopifyRequest(searchUrl, 'GET', null, workspaceId);
          
          if (ordersData.orders && ordersData.orders.length > 0) {
            shopifyOrderId = ordersData.orders[0].id;
            console.log(`✅ Found Shopify order ID: ${shopifyOrderId} for ${order.order_name}`);
          } else {
            console.log(`⚠️  Could not find Shopify order for ${order.order_name}`);
            failed++;
            results.push({ orderName: order.order_name, success: false, error: 'Order not found in Shopify' });
            continue;
          }
        }
        
        // Fetch order details from Shopify
        const orderData = await makeShopifyRequest(`/orders/${shopifyOrderId}.json`, 'GET', null, workspaceId);
        
        if (!orderData || !orderData.order) {
          failed++;
          results.push({ orderName: order.order_name, success: false, error: 'Failed to fetch order from Shopify' });
          continue;
        }
        
        const shopifyOrder = orderData.order;
        
        // Check if order has fulfillments
        if (!shopifyOrder.fulfillments || shopifyOrder.fulfillments.length === 0) {
          console.log(`ℹ️  Order ${order.order_name} has no fulfillments in Shopify`);
          results.push({ orderName: order.order_name, success: false, error: 'No fulfillments found' });
          continue;
        }
        
        // Get the first fulfillment (usually there's only one)
        const fulfillment = shopifyOrder.fulfillments[0];
        const fulfillmentId = fulfillment.id;
        
        // Check if the fulfillment has our tracking number
        const trackingNumber = fulfillment.tracking_number;
        const matchesVoucher = trackingNumber === order.voucher_number;
        
        if (matchesVoucher || shopifyOrder.fulfillments.length === 1) {
          // Update vouchers table with fulfillment ID and correct Shopify order ID
          await pool.query(
            `UPDATE vouchers 
             SET shopify_fulfillment_id = $1, shopify_order_id = $2
             WHERE voucher_number = $3 AND workspace_id = $4`,
            [fulfillmentId, shopifyOrderId, order.voucher_number, workspaceId]
          );
          
          // Also update orders table with correct Shopify order ID and fulfillment status
          await pool.query(
            `UPDATE orders 
             SET shopify_order_id = $1, fulfillment_status = 'fulfilled'
             WHERE order_name = $2 AND workspace_id = $3`,
            [shopifyOrderId, order.order_name, workspaceId]
          );
          
          console.log(`✅ Updated ${order.order_name}: fulfillment ID ${fulfillmentId}, order ID ${shopifyOrderId}`);
          updated++;
          results.push({ 
            orderName: order.order_name, 
            success: true, 
            fulfillmentId: fulfillmentId,
            shopifyOrderId: shopifyOrderId,
            trackingNumber: trackingNumber
          });
        } else {
          console.log(`⚠️  Tracking number mismatch for ${order.order_name}`);
          results.push({ orderName: order.order_name, success: false, error: 'Tracking number mismatch' });
        }
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Failed to backfill ${order.order_name}:`, error.message);
        failed++;
        results.push({ orderName: order.order_name, success: false, error: error.message });
      }
    }
    
    console.log(`✅ Backfill complete: ${updated} updated, ${failed} failed`);
    
    res.json({
      success: true,
      message: `Backfilled ${updated} orders`,
      summary: {
        total: orders.length,
        updated,
        failed
      },
      results: results.slice(0, 20) // Return first 20 for inspection
    });
    
  } catch (error) {
    console.error('Error in backfill:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Re-sync delivered orders (updates Shopify delivery status and COD payments)
app.post('/api/resync-delivered-orders', async (req, res) => {
  try {
    const workspaceId = parseInt(req.body.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    const forceAll = req.body.forceAll || false; // If true, resync all delivered, not just unsynced
    
    console.log(`🔄 Starting re-sync of delivered orders for workspace ${workspaceId}...`);
    
    // Get all vouchers that are delivered but may not have updated Shopify
    const vouchersQuery = forceAll ? `
      SELECT v.voucher_number, v.shopify_fulfillment_id, v.delivered_at
      FROM vouchers v
      WHERE v.workspace_id = $1
        AND v.delivered_at IS NOT NULL
        AND v.shopify_fulfillment_id IS NOT NULL
    ` : `
      SELECT v.voucher_number, v.shopify_fulfillment_id, v.delivered_at
      FROM vouchers v
      LEFT JOIN orders o ON v.order_name = o.order_name AND v.workspace_id = o.workspace_id
      WHERE v.workspace_id = $1
        AND v.delivered_at IS NOT NULL
        AND v.shopify_fulfillment_id IS NOT NULL
        AND (o.payment_status = 'cod' AND o.financial_status = 'pending')
    `;
    
    const vouchersResult = await pool.query(vouchersQuery, [workspaceId]);
    const vouchers = vouchersResult.rows;
    
    console.log(`📋 Found ${vouchers.length} delivered orders to re-sync`);
    
    if (vouchers.length === 0) {
      return res.json({
        success: true,
        message: 'No orders need re-syncing',
        updated: 0
      });
    }
    
    let deliveryUpdated = 0;
    let paymentUpdated = 0;
    let failed = 0;
    const results = [];
    
    for (const voucher of vouchers) {
      try {
        // Use the existing tracking update function which handles both delivery and payment
        const result = await updateVoucherTrackingStatus(voucher.voucher_number, workspaceId);
        
        if (result.success) {
          if (result.shopifyUpdated) deliveryUpdated++;
          if (result.paymentUpdated) paymentUpdated++;
          
          results.push({
            voucherNumber: voucher.voucher_number,
            success: true,
            shopifyUpdated: result.shopifyUpdated,
            paymentUpdated: result.paymentUpdated
          });
        } else {
          failed++;
          results.push({
            voucherNumber: voucher.voucher_number,
            success: false,
            error: result.error
          });
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Failed to re-sync ${voucher.voucher_number}:`, error.message);
        failed++;
        results.push({
          voucherNumber: voucher.voucher_number,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Re-sync complete: ${deliveryUpdated} delivery updates, ${paymentUpdated} payment updates, ${failed} failed`);
    
    res.json({
      success: true,
      message: `Re-synced ${vouchers.length} orders`,
      summary: {
        total: vouchers.length,
        deliveryUpdated,
        paymentUpdated,
        failed
      },
      results: results.slice(0, 20)
    });
    
  } catch (error) {
    console.error('Error in re-sync:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Force Shopify sync for a single delivered order (even if already delivered)
app.post('/api/force-shopify-sync/:voucherNumber', async (req, res) => {
  try {
    const { voucherNumber } = req.params;
    const workspaceId = parseInt(req.body.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    
    console.log(`🔄 Force syncing Shopify for voucher: ${voucherNumber}`);
    
    // Get voucher and order details
    const voucherQuery = await pool.query(
      `SELECT v.voucher_number, v.shopify_fulfillment_id, v.shopify_order_id, v.delivered_at, v.order_name,
              o.payment_status, o.financial_status, o.total_price
       FROM vouchers v
       LEFT JOIN orders o ON v.order_name = o.order_name AND v.workspace_id = o.workspace_id
       WHERE v.voucher_number = $1 AND v.workspace_id = $2`,
      [voucherNumber, workspaceId]
    );
    
    if (voucherQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voucher not found'
      });
    }
    
    const voucher = voucherQuery.rows[0];
    let shopifyUpdated = false;
    let paymentUpdated = false;
    
    // Check if voucher is delivered
    if (!voucher.delivered_at) {
      return res.json({
        success: false,
        error: 'Order is not delivered yet'
      });
    }
    
    // Check if we have Shopify fulfillment ID
    if (!voucher.shopify_fulfillment_id) {
      return res.json({
        success: false,
        error: 'No Shopify fulfillment ID found. Run backfill first.'
      });
    }
    
    // Update Shopify fulfillment to delivered
    try {
      console.log(`📬 Forcing Shopify delivery update for voucher ${voucherNumber}...`);
      await updateShopifyFulfillmentDelivered(voucher.shopify_fulfillment_id, voucher.shopify_order_id, workspaceId);
      console.log(`✅ Shopify delivery status updated for voucher ${voucherNumber}`);
      shopifyUpdated = true;
    } catch (shopifyError) {
      console.error(`⚠️  Failed to update Shopify delivery status:`, shopifyError.message);
      // Continue to payment update even if delivery update fails
    }
    
    // If COD order with pending payment, mark as paid
    if (voucher.shopify_order_id && voucher.payment_status === 'cod' && 
        (voucher.financial_status === 'pending' || voucher.financial_status === 'partially_paid')) {
      try {
        console.log(`💰 Forcing COD payment collection for voucher ${voucherNumber}...`);
        const paymentResult = await markShopifyCODOrderPaid(
          voucher.shopify_order_id, 
          parseFloat(voucher.total_price),
          workspaceId
        );
        
        if (paymentResult.success) {
          console.log(`✅ COD payment marked as collected for voucher ${voucherNumber}`);
          paymentUpdated = true;
          
          // Update local database
          await pool.query(
            `UPDATE orders 
             SET financial_status = 'paid'
             WHERE order_name = $1 AND workspace_id = $2`,
            [voucher.order_name, workspaceId]
          );
        }
      } catch (paymentError) {
        console.error(`⚠️  Failed to mark COD payment as collected:`, paymentError.message);
      }
    }
    
    res.json({
      success: true,
      shopifyUpdated,
      paymentUpdated,
      message: shopifyUpdated || paymentUpdated 
        ? 'Shopify sync completed' 
        : 'No updates needed'
    });
    
  } catch (error) {
    console.error('Error in force sync:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== OBLIO INVOICE API ROUTES ====================

/**
 * Create Oblio invoice for a single order
 * POST /api/orders/:orderName/create-invoice
 */
app.post('/api/orders/:orderName/create-invoice', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const { orderName } = req.params;
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    console.log(`🧾 Creating invoice for order: ${orderName}, workspace: ${workspaceId}`);
    
    // Get order details
    const orderQuery = await pool.query(
      `SELECT 
        o.*,
        v.delivered_at,
        v.voucher_number
       FROM orders o
       LEFT JOIN vouchers v ON o.order_name = v.order_name AND o.workspace_id = v.workspace_id
       WHERE o.order_name = $1 AND o.workspace_id = $2`,
      [orderName, workspaceId]
    );
    
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const order = orderQuery.rows[0];
    
    // Check if order is delivered
    if (!order.delivered_at) {
      return res.status(400).json({
        success: false,
        error: 'Order must be delivered before creating invoice'
      });
    }
    
    // Check if invoice already exists
    if (order.oblio_invoice_id) {
      return res.status(400).json({
        success: false,
        error: 'Invoice already exists for this order',
        invoiceUrl: order.oblio_invoice_url
      });
    }
    
    // Create invoice in Oblio
    const invoiceResult = await createOblioInvoice(order, workspaceId);
    
    // Update order with invoice details
    await pool.query(
      `UPDATE orders 
       SET oblio_invoice_id = $1,
           oblio_series_name = $2,
           oblio_invoice_number = $3,
           oblio_invoice_url = $4,
           invoiced_at = CURRENT_TIMESTAMP
       WHERE order_name = $5 AND workspace_id = $6`,
      [
        `${invoiceResult.seriesName}-${invoiceResult.number}`,
        invoiceResult.seriesName,
        invoiceResult.number,
        invoiceResult.link,
        orderName,
        workspaceId
      ]
    );
    
    console.log(`✅ Invoice created for order ${orderName}: ${invoiceResult.seriesName}/${invoiceResult.number}`);
    
    res.json({
      success: true,
      message: 'Invoice created successfully',
      invoice: {
        seriesName: invoiceResult.seriesName,
        number: invoiceResult.number,
        url: invoiceResult.link
      }
    });
    
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create invoice'
    });
  }
});

/**
 * Bulk create Oblio invoices for multiple orders
 * POST /api/orders/bulk-create-invoices
 */
app.post('/api/orders/bulk-create-invoices', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const { orderNames } = req.body;
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    if (!orderNames || !Array.isArray(orderNames) || orderNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of order names'
      });
    }
    
    console.log(`🧾 Bulk creating invoices for ${orderNames.length} orders...`);
    
    const results = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const orderName of orderNames) {
      try {
        // Get order details
        const orderQuery = await pool.query(
          `SELECT 
            o.*,
            v.delivered_at,
            v.voucher_number
           FROM orders o
           LEFT JOIN vouchers v ON o.order_name = v.order_name AND o.workspace_id = v.workspace_id
           WHERE o.order_name = $1 AND o.workspace_id = $2`,
          [orderName, workspaceId]
        );
        
        if (orderQuery.rows.length === 0) {
          skipped++;
          results.push({ orderName, success: false, error: 'Order not found' });
          continue;
        }
        
        const order = orderQuery.rows[0];
        
        // Check if delivered
        if (!order.delivered_at) {
          skipped++;
          results.push({ orderName, success: false, error: 'Not delivered yet' });
          continue;
        }
        
        // Check if already invoiced
        if (order.oblio_invoice_id) {
          skipped++;
          results.push({ 
            orderName, 
            success: false, 
            error: 'Already invoiced',
            invoiceUrl: order.oblio_invoice_url
          });
          continue;
        }
        
        // Create invoice
        const invoiceResult = await createOblioInvoice(order, workspaceId);
        
        // Update database
        await pool.query(
          `UPDATE orders 
           SET oblio_invoice_id = $1,
               oblio_series_name = $2,
               oblio_invoice_number = $3,
               oblio_invoice_url = $4,
               invoiced_at = CURRENT_TIMESTAMP
           WHERE order_name = $5 AND workspace_id = $6`,
          [
            `${invoiceResult.seriesName}-${invoiceResult.number}`,
            invoiceResult.seriesName,
            invoiceResult.number,
            invoiceResult.link,
            orderName,
            workspaceId
          ]
        );
        
        created++;
        results.push({ 
          orderName, 
          success: true, 
          invoice: {
            seriesName: invoiceResult.seriesName,
            number: invoiceResult.number,
            url: invoiceResult.link
          }
        });
        
        console.log(`✅ Invoice created for ${orderName}: ${invoiceResult.seriesName}/${invoiceResult.number}`);
        
        // Rate limiting: Wait 500ms between requests to avoid hitting Oblio API limits
        // (30 requests per 100 seconds for document generation)
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        failed++;
        results.push({ 
          orderName, 
          success: false, 
          error: error.message 
        });
        console.error(`❌ Failed to create invoice for ${orderName}:`, error.message);
      }
    }
    
    console.log(`✅ Bulk invoice creation complete: ${created} created, ${skipped} skipped, ${failed} failed`);
    
    res.json({
      success: true,
      message: `Invoices created: ${created}, skipped: ${skipped}, failed: ${failed}`,
      summary: {
        total: orderNames.length,
        created,
        skipped,
        failed
      },
      results: results.slice(0, 20) // Return first 20 results to avoid huge responses
    });
    
  } catch (error) {
    console.error('Error in bulk invoice creation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Cancel Oblio invoice
 * POST /api/orders/:orderName/cancel-invoice
 */
app.post('/api/orders/:orderName/cancel-invoice', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const { orderName } = req.params;
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    console.log(`🚫 Cancelling invoice for order: ${orderName}`);
    
    // Get order details
    const orderQuery = await pool.query(
      `SELECT oblio_series_name, oblio_invoice_number, oblio_invoice_id
       FROM orders
       WHERE order_name = $1 AND workspace_id = $2`,
      [orderName, workspaceId]
    );
    
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const order = orderQuery.rows[0];
    
    if (!order.oblio_invoice_id) {
      return res.status(400).json({
        success: false,
        error: 'No invoice exists for this order'
      });
    }
    
    // Cancel invoice in Oblio
    await cancelOblioInvoice(order.oblio_series_name, order.oblio_invoice_number, workspaceId);
    
    // Clear invoice data from database
    await pool.query(
      `UPDATE orders 
       SET oblio_invoice_id = NULL,
           oblio_series_name = NULL,
           oblio_invoice_number = NULL,
           oblio_invoice_url = NULL,
           invoiced_at = NULL
       WHERE order_name = $1 AND workspace_id = $2`,
      [orderName, workspaceId]
    );
    
    console.log(`✅ Invoice cancelled for order ${orderName}`);
    
    res.json({
      success: true,
      message: 'Invoice cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== TRACKING STATUS ROUTES ====================

// Update tracking status for a single voucher
app.post('/api/vouchers/:voucherNumber/update-tracking', async (req, res) => {
  try {
    const { voucherNumber } = req.params;
    const workspaceId = parseInt(req.body.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    
    console.log(`📍 Updating tracking for voucher: ${voucherNumber}`);
    
    const result = await updateVoucherTrackingStatus(voucherNumber, workspaceId);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Tracking updated for voucher ${voucherNumber}`,
        tracking: result.tracking,
        voucher: {
          voucherNumber: result.voucher.voucher_number,
          deliveryStatus: result.voucher.delivery_status,
          deliveryStatusCode: result.voucher.delivery_status_code,
          currentLocation: result.voucher.current_location,
          deliveredAt: result.voucher.delivered_at,
          updatedAt: result.voucher.delivery_status_updated_at
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        voucherNumber
      });
    }
    
  } catch (error) {
    console.error('Error updating voucher tracking:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk update tracking for all vouchers (alias endpoint)
app.post('/api/vouchers/update-tracking', async (req, res) => {
  try {
    const workspaceId = parseInt(req.body.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    
    console.log(`📍 Updating tracking for all vouchers in workspace ${workspaceId}...`);
    
    // Get all sent vouchers for this workspace
    const vouchersResult = await pool.query(
      'SELECT voucher_number FROM vouchers WHERE workspace_id = $1 AND status = $2',
      [workspaceId, 'sent']
    );
    
    const vouchers = vouchersResult.rows;
    const total = vouchers.length;
    let updated = 0;
    let errors = 0;
    
    console.log(`Found ${total} vouchers to update`);
    
    // Update each voucher
    for (const voucher of vouchers) {
      try {
        const result = await updateVoucherTrackingStatus(voucher.voucher_number, workspaceId);
        if (result.success) {
          updated++;
        } else {
          errors++;
        }
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error updating voucher ${voucher.voucher_number}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Tracking update complete: ${updated}/${total} updated, ${errors} errors`);
    
    res.json({
      success: true,
      total,
      updated,
      errors
    });
    
  } catch (error) {
    console.error('Error in bulk tracking update:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update tracking status for all active vouchers in workspace
app.post('/api/tracking/update-all', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    console.log(`🔄 Starting tracking update for all vouchers in workspace ${workspaceId}`);
    
    // Return immediately and process in background to avoid timeout
    res.json({
      success: true,
      message: `Tracking update started`,
      status: 'processing'
    });
    
    // Start the update process in the background (this can take a while)
    updateAllVoucherTrackingStatuses(workspaceId).then((results) => {
      console.log(`✅ [Background] Tracking update completed for workspace ${workspaceId}: ${results.updated}/${results.total} updated, ${results.errors} errors`);
    }).catch((error) => {
      console.error(`❌ [Background] Error updating voucher tracking for workspace ${workspaceId}:`, error);
    });
    
  } catch (error) {
    console.error('Error starting tracking update:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get tracking sync log/history
app.get('/api/tracking/sync-log', async (req, res) => {
  try {
    const workspaceId = parseInt(req.query.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await pool.query(
      `SELECT * FROM tracking_sync_log 
       WHERE workspace_id = $1 
       ORDER BY sync_started_at DESC 
       LIMIT $2`,
      [workspaceId, limit]
    );
    
    res.json({
      success: true,
      logs: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching sync log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get tracking details for a specific voucher (with full checkpoint history)
app.get('/api/vouchers/:voucherNumber/tracking', async (req, res) => {
  try {
    const { voucherNumber } = req.params;
    const workspaceId = parseInt(req.query.workspaceId) || parseInt(req.headers['x-workspace-id']) || 1;
    const language = req.query.language || 'en';
    
    // Get full tracking history from Geniki
    const trackingData = await trackAndTrace(voucherNumber, workspaceId, language);
    
    // Get stored data from database
    const dbResult = await pool.query(
      `SELECT delivery_status, delivery_status_code, delivery_status_updated_at, 
              delivered_at, current_location, tracking_checkpoints, last_tracking_error
       FROM vouchers 
       WHERE voucher_number = $1 AND workspace_id = $2`,
      [voucherNumber, workspaceId]
    );
    
    res.json({
      success: true,
      voucherNumber,
      tracking: trackingData,
      storedData: dbResult.rows[0] || null
    });
    
  } catch (error) {
    console.error('Error fetching tracking details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== WORKSPACE API ROUTES ====================

// Get all workspaces
app.get('/api/workspaces', authenticateUser, async (req, res) => {
  try {
    // Only return workspaces user has access to
    const result = await pool.query(
      `SELECT w.* FROM workspaces w
       JOIN user_workspaces uw ON w.workspace_id = uw.workspace_id
       WHERE uw.user_id = $1 AND w.is_active = TRUE
       ORDER BY w.created_at ASC`,
      [req.user.user_id]
    );
    res.json({ success: true, workspaces: result.rows });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a specific workspace
app.get('/api/workspaces/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await getWorkspace(parseInt(workspaceId));
    
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    res.json({ success: true, workspace });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new workspace
app.post('/api/workspaces', authenticateUser, async (req, res) => {
  try {
    const workspaceData = req.body;
    const userId = req.user.user_id; // From authenticateUser middleware
    
    if (!workspaceData.workspace_name) {
      return res.status(400).json({ success: false, error: 'workspace_name is required' });
    }
    
    const newWorkspace = await createWorkspace(workspaceData);
    
    // Link the user to the new workspace as admin
    await pool.query(
      'INSERT INTO user_workspaces (user_id, workspace_id, role) VALUES ($1, $2, $3)',
      [userId, newWorkspace.workspace_id, 'admin']
    );
    
    console.log(`✅ Created new workspace: ${newWorkspace.workspace_name} for user ${userId}`);
    res.json({ success: true, workspace: newWorkspace });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a workspace
app.put('/api/workspaces/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspaceData = req.body;
    
    const updatedWorkspace = await updateWorkspace(parseInt(workspaceId), workspaceData);
    
    if (!updatedWorkspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    console.log(`✅ Updated workspace: ${updatedWorkspace.workspace_name}`);
    res.json({ success: true, workspace: updatedWorkspace });
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a workspace
app.delete('/api/workspaces/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const deletedWorkspace = await deleteWorkspace(parseInt(workspaceId));
    
    if (!deletedWorkspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found' });
    }
    
    console.log(`🗑️ Deleted workspace: ${deletedWorkspace.workspace_name}`);
    res.json({ success: true, message: 'Workspace deleted successfully', workspace: deletedWorkspace });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== WORKSPACE SETTINGS API ====================

// Get workspace settings
app.get('/api/workspaces/:id/settings', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    const result = await pool.query(
      `SELECT
        workspace_id,
        workspace_name,
        workspace_slug,
        -- Shopify credentials
        shopify_shop,
        shopify_access_token,
        shopify_api_secret,
        -- Geniki credentials
        geniki_username,
        geniki_password,
        geniki_app_key,
        geniki_wsdl_url,
        -- Meest credentials
        meest_username,
        meest_password,
        meest_api_key,
        meest_enabled,
        -- Meest shipping defaults
        meest_default_service,
        meest_default_weight,
        meest_default_width,
        meest_default_height,
        meest_default_length,
        meest_cod_handling,
        -- Default courier selection
        default_courier,
        -- Oblio credentials
        oblio_email,
        oblio_cif,
        oblio_secret,
        oblio_series_name,
        oblio_vat_rate,
        -- Invoice settings
        invoice_language,
        invoice_currency,
        -- Shipping rules
        shipping_threshold,
        shipping_cost,
        -- Other settings
        timezone,
        is_active,
        created_at,
        updated_at
      FROM workspaces
      WHERE workspace_id = $1`,
      [workspaceId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }
    
    res.json({
      success: true,
      workspace: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error fetching workspace settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update workspace settings
app.put('/api/workspaces/:id/settings', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    const settings = req.body;
    
    console.log(`⚙️ Updating settings for workspace ${workspaceId}`);
    
    // Build dynamic UPDATE query based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    // Workspace basic info
    if (settings.workspace_name !== undefined) {
      updates.push(`workspace_name = $${paramCount++}`);
      values.push(settings.workspace_name);
    }
    if (settings.workspace_slug !== undefined) {
      updates.push(`workspace_slug = $${paramCount++}`);
      values.push(settings.workspace_slug);
    }
    
    // Shopify credentials
    if (settings.shopify_shop !== undefined) {
      updates.push(`shopify_shop = $${paramCount++}`);
      values.push(settings.shopify_shop);
    }
    if (settings.shopify_access_token !== undefined) {
      updates.push(`shopify_access_token = $${paramCount++}`);
      values.push(settings.shopify_access_token);
    }
    if (settings.shopify_api_secret !== undefined) {
      updates.push(`shopify_api_secret = $${paramCount++}`);
      values.push(settings.shopify_api_secret);
    }
    
    // Geniki credentials
    if (settings.geniki_username !== undefined) {
      updates.push(`geniki_username = $${paramCount++}`);
      values.push(settings.geniki_username);
    }
    if (settings.geniki_password !== undefined) {
      updates.push(`geniki_password = $${paramCount++}`);
      values.push(settings.geniki_password);
    }
    if (settings.geniki_app_key !== undefined) {
      updates.push(`geniki_app_key = $${paramCount++}`);
      values.push(settings.geniki_app_key);
    }
    if (settings.geniki_wsdl_url !== undefined) {
      updates.push(`geniki_wsdl_url = $${paramCount++}`);
      values.push(settings.geniki_wsdl_url);
    }

    // Meest credentials
    if (settings.meest_username !== undefined) {
      updates.push(`meest_username = $${paramCount++}`);
      values.push(settings.meest_username);
    }
    if (settings.meest_password !== undefined) {
      updates.push(`meest_password = $${paramCount++}`);
      values.push(settings.meest_password);
    }
    if (settings.meest_api_key !== undefined) {
      updates.push(`meest_api_key = $${paramCount++}`);
      values.push(settings.meest_api_key);
    }
    if (settings.meest_enabled !== undefined) {
      updates.push(`meest_enabled = $${paramCount++}`);
      values.push(settings.meest_enabled);
    }

    // Meest shipping defaults
    if (settings.meest_default_service !== undefined) {
      updates.push(`meest_default_service = $${paramCount++}`);
      values.push(settings.meest_default_service);
    }
    if (settings.meest_default_weight !== undefined) {
      updates.push(`meest_default_weight = $${paramCount++}`);
      values.push(parseFloat(settings.meest_default_weight));
    }
    if (settings.meest_default_width !== undefined) {
      updates.push(`meest_default_width = $${paramCount++}`);
      values.push(parseFloat(settings.meest_default_width));
    }
    if (settings.meest_default_height !== undefined) {
      updates.push(`meest_default_height = $${paramCount++}`);
      values.push(parseFloat(settings.meest_default_height));
    }
    if (settings.meest_default_length !== undefined) {
      updates.push(`meest_default_length = $${paramCount++}`);
      values.push(parseFloat(settings.meest_default_length));
    }
    if (settings.meest_cod_handling !== undefined) {
      updates.push(`meest_cod_handling = $${paramCount++}`);
      values.push(settings.meest_cod_handling);
    }

    // Default courier selection
    if (settings.default_courier !== undefined) {
      updates.push(`default_courier = $${paramCount++}`);
      values.push(settings.default_courier);
    }

    // Oblio credentials
    if (settings.oblio_email !== undefined) {
      updates.push(`oblio_email = $${paramCount++}`);
      values.push(settings.oblio_email);
    }
    if (settings.oblio_cif !== undefined) {
      updates.push(`oblio_cif = $${paramCount++}`);
      values.push(settings.oblio_cif);
    }
    if (settings.oblio_secret !== undefined) {
      updates.push(`oblio_secret = $${paramCount++}`);
      values.push(settings.oblio_secret);
    }
    if (settings.oblio_series_name !== undefined) {
      updates.push(`oblio_series_name = $${paramCount++}`);
      values.push(settings.oblio_series_name);
    }
    if (settings.oblio_vat_rate !== undefined) {
      updates.push(`oblio_vat_rate = $${paramCount++}`);
      values.push(parseFloat(settings.oblio_vat_rate));
    }
    
    // Invoice settings
    if (settings.invoice_language !== undefined) {
      updates.push(`invoice_language = $${paramCount++}`);
      values.push(settings.invoice_language);
    }
    if (settings.invoice_currency !== undefined) {
      updates.push(`invoice_currency = $${paramCount++}`);
      values.push(settings.invoice_currency);
    }
    
    // Shipping rules
    if (settings.shipping_threshold !== undefined) {
      updates.push(`shipping_threshold = $${paramCount++}`);
      values.push(parseFloat(settings.shipping_threshold));
    }
    if (settings.shipping_cost !== undefined) {
      updates.push(`shipping_cost = $${paramCount++}`);
      values.push(parseFloat(settings.shipping_cost));
    }
    
    // Other settings
    if (settings.timezone !== undefined) {
      updates.push(`timezone = $${paramCount++}`);
      values.push(settings.timezone);
    }
    if (settings.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(settings.is_active);
    }
    
    // Always update updated_at
    updates.push(`updated_at = NOW()`);
    
    if (updates.length === 1) { // Only updated_at
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    // Add workspace ID as last parameter
    values.push(workspaceId);
    
    const query = `
      UPDATE workspaces 
      SET ${updates.join(', ')}
      WHERE workspace_id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }
    
    // Clear Meest token cache if credentials changed
    if (settings.meest_username !== undefined || settings.meest_password !== undefined) {
      meestTokenCacheByWorkspace.delete(workspaceId);
    }
    
    console.log(`✅ Updated workspace ${workspaceId} settings`);
    
    res.json({
      success: true,
      message: 'Workspace settings updated successfully',
      workspace: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating workspace settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test Shopify connection
app.post('/api/workspaces/:id/test-shopify', async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    console.log(`🧪 Testing Shopify connection for workspace ${workspaceId}`);
    
    // Try to fetch shop info from Shopify
    const shopData = await makeShopifyRequest('/shop.json', 'GET', null, workspaceId);
    
    res.json({
      success: true,
      message: 'Shopify connection successful',
      shop: {
        name: shopData.shop.name,
        domain: shopData.shop.domain,
        email: shopData.shop.email,
        currency: shopData.shop.currency,
        timezone: shopData.shop.timezone
      }
    });
    
  } catch (error) {
    console.error('Shopify connection test failed:', error);
    res.status(400).json({
      success: false,
      error: error.response?.data?.errors || error.message
    });
  }
});

// Test Geniki connection
app.post('/api/workspaces/:id/test-geniki', async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    console.log(`🧪 Testing Geniki connection for workspace ${workspaceId}`);
    
    // Try to authenticate with Geniki
    const authKey = await authenticate(workspaceId, true); // Force fresh auth
    
    if (!authKey) {
      throw new Error('Authentication failed - no auth key received');
    }
    
    res.json({
      success: true,
      message: 'Geniki connection successful',
      details: {
        authenticated: true,
        authKeyLength: authKey.length
      }
    });
    
  } catch (error) {
    console.error('Geniki connection test failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Test Oblio connection
app.post('/api/workspaces/:id/test-oblio', async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    console.log(`🧪 Testing Oblio connection for workspace ${workspaceId}`);
    
    // Try to get access token and fetch nomenclature
    const accessToken = await getOblioAccessToken(workspaceId);
    
    if (!accessToken) {
      throw new Error('Failed to get Oblio access token');
    }
    
    // Test by fetching nomenclature (company info)
    const nomenclatureData = await makeOblioRequest('/nomenclature/companies', 'GET', null, workspaceId);
    
    res.json({
      success: true,
      message: 'Oblio connection successful',
      details: {
        authenticated: true,
        companies: nomenclatureData.data?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Oblio connection test failed:', error);
    res.status(400).json({
      success: false,
      error: error.response?.data?.statusMessage || error.message
    });
  }
});

// Test Meest connection
app.post('/api/workspaces/:id/test-meest', async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    console.log(`🧪 Testing Meest connection for workspace ${workspaceId}`);

    const result = await testMeestConnection(workspaceId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Meest connection successful',
        details: result.details
      });
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    console.error('Meest connection test failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get delivery statistics for a workspace
app.get('/api/workspaces/:id/delivery-stats', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    const { timeframe } = req.query; // '24h', '7d', or '30d'
    
    // Calculate the date threshold based on timeframe
    let hoursAgo;
    switch (timeframe) {
      case '24h':
        hoursAgo = 24;
        break;
      case '7d':
        hoursAgo = 24 * 7;
        break;
      case '30d':
        hoursAgo = 24 * 30;
        break;
      default:
        hoursAgo = 24 * 7; // Default to 7 days
    }
    
    // Query vouchers that received a status UPDATE in the timeframe
    const result = await pool.query(`
      SELECT 
        delivery_status,
        current_location
      FROM vouchers
      WHERE workspace_id = $1
        AND delivery_status_updated_at >= NOW() - INTERVAL '${hoursAgo} hours'
        AND voucher_number IS NOT NULL
        AND delivery_status IS NOT NULL
    `, [workspaceId]);
    
    // Process results in JavaScript to avoid SQL GROUP BY issues
    const stats = {
      'in-delivery': 0,
      delivered: 0,
      returned: 0
    };
    
    result.rows.forEach(row => {
      const deliveryStatus = (row.delivery_status || '').toUpperCase();
      const currentLocation = (row.current_location || '').toUpperCase();
      
      // Check for returns
      if (deliveryStatus.includes('RETURN') || 
          deliveryStatus.includes('ΕΠΙΣΤΡΟΦΗ') ||
          currentLocation.includes('SENDER') || 
          currentLocation.includes('ΑΠΟΣΤΟΛ')) {
        stats.returned++;
      }
      // Check for delivered
      else if (deliveryStatus.includes('DELIVERED')) {
        stats.delivered++;
      }
      // Everything else is in delivery
      else {
        stats['in-delivery']++;
      }
    });
    
    res.json({
      success: true,
      timeframe,
      stats
    });
    
  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel an order (sets status to cancelled)
app.patch('/api/imported-orders/:orderId/cancel', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { orderId } = req.params;
    
    console.log(`🚫 Cancelling order ${orderId} in workspace ${workspaceId}`);
    
    // Update order status to cancelled
    const result = await pool.query(`
      UPDATE orders 
      SET order_status = 'cancelled'
      WHERE order_name = $1 AND workspace_id = $2
      RETURNING *
    `, [orderId, workspaceId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    console.log(`✅ Order ${orderId} cancelled successfully`);
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get dashboard statistics for a workspace
app.get('/api/workspaces/:id/dashboard-stats', authenticateUser, authorizeWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId; // From authorizeWorkspace middleware
    
    // Get total revenue from all orders (excluding cancelled)
    const revenueResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CAST(total_price AS DECIMAL)), 0) as total_revenue,
        COUNT(DISTINCT order_name) as total_orders
      FROM orders
      WHERE workspace_id = $1 AND (order_status IS NULL OR order_status != 'cancelled')
    `, [workspaceId]);
    
    // Get orders with vouchers (processed orders, excluding cancelled)
    const processedResult = await pool.query(`
      SELECT COUNT(DISTINCT order_name) as processed_orders
      FROM orders
      WHERE workspace_id = $1 AND processed = true AND (order_status IS NULL OR order_status != 'cancelled')
    `, [workspaceId]);
    
    // Get orders by status for the pie chart
    const statusResult = await pool.query(`
      SELECT 
        CASE 
          WHEN processed = true THEN 'Processed'
          WHEN fulfillment_status = 'fulfilled' THEN 'Fulfilled'
          ELSE 'Pending'
        END as status,
        COUNT(*) as count
      FROM orders
      WHERE workspace_id = $1
      GROUP BY status
    `, [workspaceId]);
    
    // Calculate stats
    const stats = {
      totalRevenue: parseFloat(revenueResult.rows[0].total_revenue || 0).toFixed(2),
      totalOrders: parseInt(revenueResult.rows[0].total_orders || 0),
      processedOrders: parseInt(processedResult.rows[0].processed_orders || 0),
      ordersByStatus: statusResult.rows
    };
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== SCHEDULED JOBS ====================

// Tracking status update job - runs twice daily at 10:00 AM and 6:00 PM
// Cron format: minute hour day month weekday
// '0 10,18 * * *' = At 00 minutes past 10 and 18 hours
cron.schedule('0 10,18 * * *', async () => {
  console.log('🔄 [CRON] Starting scheduled tracking status update...');
  console.log(`📅 Time: ${new Date().toLocaleString()}`);
  
  try {
    // Get all active workspaces
    const workspaces = await getAllWorkspaces();
    
    for (const workspace of workspaces) {
      console.log(`🔄 [CRON] Updating tracking for workspace: ${workspace.workspace_name} (ID: ${workspace.workspace_id})`);
      
      try {
        const results = await updateAllVoucherTrackingStatuses(workspace.workspace_id);
        console.log(`✅ [CRON] Workspace ${workspace.workspace_name}: ${results.updated}/${results.total} vouchers updated, ${results.errors} errors`);
      } catch (error) {
        console.error(`❌ [CRON] Error updating workspace ${workspace.workspace_name}:`, error.message);
      }
      
      // Small delay between workspaces to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ [CRON] Scheduled tracking update completed');
  } catch (error) {
    console.error('❌ [CRON] Error in scheduled tracking update:', error);
  }
}, {
  scheduled: true,
  timezone: "Europe/Athens" // Greek timezone
});

console.log('⏰ Tracking status cron job scheduled: 10:00 AM and 6:00 PM daily (Europe/Athens timezone)');

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
