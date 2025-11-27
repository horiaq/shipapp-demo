# Multi-Courier Provider Implementation Plan

## 🎯 Goal
Integrate Meest courier API alongside existing Geniki implementation without breaking current functionality.

## 📋 Overview
This plan follows a **safe, incremental approach** where each step is tested before moving to the next. The existing Geniki functionality will continue to work throughout the entire process.

---

## Phase 1: Database Preparation (Non-Breaking)

### Step 1.1: Create Database Migration Script
**Time Estimate:** 10 minutes  
**Risk Level:** 🟢 Low (additive changes only)

Create a new file: `database-courier-provider-migration.sql`

```sql
-- Add courier provider columns to workspaces table
-- These are ADDITIVE changes with safe defaults
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS courier_provider VARCHAR(50) DEFAULT 'geniki',
ADD COLUMN IF NOT EXISTS courier_credentials JSONB DEFAULT '{}';

-- Update existing workspaces to use Geniki with current credentials
-- This ensures backward compatibility
UPDATE workspaces
SET courier_provider = 'geniki',
    courier_credentials = jsonb_build_object(
        'username', '${GENIKI_USERNAME}',
        'password', '${GENIKI_PASSWORD}',
        'appKey', '${GENIKI_APPKEY}'
    )
WHERE courier_provider IS NULL OR courier_credentials = '{}';

-- Add helpful comment
COMMENT ON COLUMN workspaces.courier_provider IS 'Courier service provider: geniki, meest, etc.';
COMMENT ON COLUMN workspaces.courier_credentials IS 'JSON object containing provider-specific credentials';
```

**Testing:**
```bash
# Connect to PostgreSQL
psql -U postgres -d geniki_shipping

# Run migration
\i database-courier-provider-migration.sql

# Verify columns exist
\d workspaces

# Verify existing data preserved
SELECT workspace_id, workspace_name, courier_provider FROM workspaces;

# Should show all workspaces with courier_provider = 'geniki'
```

**Rollback (if needed):**
```sql
ALTER TABLE workspaces DROP COLUMN IF EXISTS courier_provider;
ALTER TABLE workspaces DROP COLUMN IF EXISTS courier_credentials;
```

**Success Criteria:**
- ✅ New columns exist
- ✅ All existing workspaces have `courier_provider = 'geniki'`
- ✅ Application still works (server doesn't crash)
- ✅ Can still create vouchers with Geniki

---

## Phase 2: Backend Refactoring (Non-Breaking)

### Step 2.1: Create Courier Provider Directory Structure
**Time Estimate:** 5 minutes  
**Risk Level:** 🟢 Low (new files only)

Create new directory structure:

```bash
mkdir -p server/couriers
touch server/couriers/CourierProvider.js
touch server/couriers/GeinikiCourier.js
touch server/couriers/MeestCourier.js
touch server/couriers/CourierFactory.js
```

**Testing:**
```bash
# Verify files created
ls -la server/couriers/
```

**Success Criteria:**
- ✅ Directory and files exist
- ✅ Server still runs (no syntax errors)

---

### Step 2.2: Create Base CourierProvider Interface
**Time Estimate:** 10 minutes  
**Risk Level:** 🟢 Low (interface definition only)

Create `server/couriers/CourierProvider.js`:

```javascript
/**
 * Base class for all courier provider implementations
 * All courier providers must implement these methods
 */
class CourierProvider {
  constructor(credentials, isTestMode = false) {
    this.credentials = credentials;
    this.isTestMode = isTestMode;
  }

  /**
   * Authenticate with the courier API
   * @returns {Promise<string>} Authentication token/key
   */
  async authenticate() {
    throw new Error('authenticate() must be implemented by subclass');
  }

  /**
   * Create a shipping voucher/label
   * @param {Object} orderData - Normalized order data
   * @returns {Promise<Object>} { voucherNumber, jobId, pdfBase64 (optional) }
   */
  async createVoucher(orderData) {
    throw new Error('createVoucher() must be implemented by subclass');
  }

  /**
   * Get voucher PDF
   * @param {string} voucherNumber - The voucher/tracking number
   * @returns {Promise<Buffer>} PDF file as buffer
   */
  async getVoucherPdf(voucherNumber) {
    throw new Error('getVoucherPdf() must be implemented by subclass');
  }

  /**
   * Get multiple voucher PDFs combined
   * @param {string[]} voucherNumbers - Array of voucher numbers
   * @returns {Promise<Buffer>} Combined PDF file as buffer
   */
  async getMultipleVouchersPdf(voucherNumbers) {
    throw new Error('getMultipleVouchersPdf() must be implemented by subclass');
  }

  /**
   * Cancel a voucher
   * @param {string} voucherNumber - The voucher/tracking number
   * @returns {Promise<void>}
   */
  async cancelVoucher(voucherNumber) {
    throw new Error('cancelVoucher() must be implemented by subclass');
  }

  /**
   * Track a shipment
   * @param {string} voucherNumber - The voucher/tracking number
   * @returns {Promise<Object>} Tracking information
   */
  async trackVoucher(voucherNumber) {
    throw new Error('trackVoucher() must be implemented by subclass');
  }

  /**
   * Finalize/close pending shipments for a date
   * @param {Date} date - The date to finalize (default: today)
   * @returns {Promise<Object>} Finalization result
   */
  async finalizeShipments(date = new Date()) {
    throw new Error('finalizeShipments() must be implemented by subclass');
  }

  /**
   * Get provider name
   * @returns {string} Provider name (e.g., 'geniki', 'meest')
   */
  getProviderName() {
    throw new Error('getProviderName() must be implemented by subclass');
  }
}

module.exports = CourierProvider;
```

**Testing:**
```bash
# Test syntax
node -c server/couriers/CourierProvider.js

# Should output nothing (no syntax errors)
```

**Success Criteria:**
- ✅ File has no syntax errors
- ✅ Can be required without errors
- ✅ Server still runs

---

### Step 2.3: Move Geniki Code to GeinikiCourier Class
**Time Estimate:** 30 minutes  
**Risk Level:** 🟡 Medium (refactoring existing code)

**IMPORTANT:** This is a **COPY then TEST** approach, not a move. We keep the original code in `server.js` working while we test the new class.

Create `server/couriers/GeinikiCourier.js`:

```javascript
const CourierProvider = require('./CourierProvider');
const soap = require('soap');
const axios = require('axios');

class GeinikiCourier extends CourierProvider {
  constructor(credentials, isTestMode = false) {
    super(credentials, isTestMode);
    
    this.wsdlUrl = isTestMode 
      ? 'https://testvoucher.taxydromiki.gr/JobServicesV2.asmx?WSDL'
      : 'https://voucher.taxydromiki.gr/JobServicesV2.asmx?WSDL';
    
    this.authCache = {
      key: null,
      expiryTime: null
    };
  }

  getProviderName() {
    return 'geniki';
  }

  // COPY all existing Geniki functions from server.js:
  // - authenticate()
  // - createVoucher()
  // - getVoucherPdf()
  // - getMultipleVouchersPdf()
  // - cancelVoucher()
  // - trackVoucher()
  // - finalizeShipments()
  // - Helper functions: determineServices(), calculateWeight(), etc.

  async authenticate(forceRefresh = false) {
    // Copy existing authenticate function from server.js
    // ... (exact same code)
  }

  async createVoucher(orderData) {
    // Copy existing createVoucher function from server.js
    // ... (exact same code)
  }

  async getVoucherPdf(voucherNumber) {
    // Copy existing getVoucherPdf function from server.js
    // ... (exact same code)
  }

  async getMultipleVouchersPdf(voucherNumbers) {
    // Copy existing getMultipleVouchersPdf function from server.js
    // ... (exact same code)
  }

  async cancelVoucher(voucherNumber) {
    // Copy existing cancelJob function from server.js
    // ... (exact same code)
  }

  async trackVoucher(voucherNumber) {
    // Implement using existing TrackAndTrace logic
    // ... (if exists in server.js)
  }

  async finalizeShipments(date = new Date()) {
    // Copy existing closePendingJobs function from server.js
    // ... (exact same code)
  }

  // Helper functions (private methods)
  determineServices(orderData) {
    // Copy from server.js
  }

  calculateWeight(orderData) {
    // Copy from server.js
  }
}

module.exports = GeinikiCourier;
```

**Testing:**
```bash
# Test syntax
node -c server/couriers/GeinikiCourier.js

# Create a test file: test-geniki-courier.js
cat > test-geniki-courier.js << 'EOF'
require('dotenv').config();
const GeinikiCourier = require('./server/couriers/GeinikiCourier');

async function test() {
  console.log('🧪 Testing GeinikiCourier class...\n');
  
  const geniki = new GeinikiCourier({
    username: process.env.GENIKI_USERNAME,
    password: process.env.GENIKI_PASSWORD,
    appKey: process.env.GENIKI_APPKEY
  }, true); // true = test mode
  
  try {
    console.log('1. Testing authentication...');
    const authKey = await geniki.authenticate();
    console.log('✅ Authentication successful:', authKey.substring(0, 20) + '...');
    
    console.log('\n2. Testing provider name...');
    console.log('✅ Provider:', geniki.getProviderName());
    
    console.log('\n✅ All tests passed! GeinikiCourier class works correctly.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
EOF

# Run test
node test-geniki-courier.js

# Clean up test file
rm test-geniki-courier.js
```

**Success Criteria:**
- ✅ GeinikiCourier class can authenticate
- ✅ No syntax errors
- ✅ Original server.js still works (we haven't modified it yet)
- ✅ Can create test vouchers using the class

---

### Step 2.4: Create CourierFactory
**Time Estimate:** 15 minutes  
**Risk Level:** 🟢 Low (new file)

Create `server/couriers/CourierFactory.js`:

```javascript
const GeinikiCourier = require('./GeinikiCourier');
const MeestCourier = require('./MeestCourier');

class CourierFactory {
  /**
   * Create a courier provider instance
   * @param {string} provider - Provider name ('geniki', 'meest')
   * @param {Object} credentials - Provider-specific credentials
   * @param {boolean} isTestMode - Whether to use test/staging environment
   * @returns {CourierProvider} Courier provider instance
   */
  static createCourier(provider, credentials, isTestMode = false) {
    const providerLower = provider.toLowerCase();
    
    switch (providerLower) {
      case 'geniki':
        return new GeinikiCourier(credentials, isTestMode);
      
      case 'meest':
        return new MeestCourier(credentials, isTestMode);
      
      default:
        throw new Error(`Unknown courier provider: ${provider}. Supported: geniki, meest`);
    }
  }

  /**
   * Get list of supported providers
   * @returns {string[]} Array of provider names
   */
  static getSupportedProviders() {
    return ['geniki', 'meest'];
  }

  /**
   * Check if a provider is supported
   * @param {string} provider - Provider name to check
   * @returns {boolean} True if supported
   */
  static isProviderSupported(provider) {
    return this.getSupportedProviders().includes(provider.toLowerCase());
  }
}

module.exports = CourierFactory;
```

**Testing:**
```bash
# Test syntax
node -c server/couriers/CourierFactory.js

# Create test
cat > test-courier-factory.js << 'EOF'
require('dotenv').config();
const CourierFactory = require('./server/couriers/CourierFactory');

console.log('🧪 Testing CourierFactory...\n');

console.log('1. Supported providers:', CourierFactory.getSupportedProviders());
console.log('2. Is Geniki supported?', CourierFactory.isProviderSupported('geniki'));
console.log('3. Is Meest supported?', CourierFactory.isProviderSupported('meest'));
console.log('4. Is DHL supported?', CourierFactory.isProviderSupported('dhl'));

try {
  console.log('\n5. Creating Geniki courier...');
  const geniki = CourierFactory.createCourier('geniki', {
    username: process.env.GENIKI_USERNAME,
    password: process.env.GENIKI_PASSWORD,
    appKey: process.env.GENIKI_APPKEY
  }, true);
  console.log('✅ Geniki courier created:', geniki.getProviderName());
  
  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
EOF

node test-courier-factory.js
rm test-courier-factory.js
```

**Success Criteria:**
- ✅ Factory can create Geniki courier
- ✅ Factory lists supported providers
- ✅ No syntax errors

---

### Step 2.5: Create Meest Courier Stub (Non-Functional)
**Time Estimate:** 20 minutes  
**Risk Level:** 🟢 Low (stub only, not used yet)

Create `server/couriers/MeestCourier.js`:

```javascript
const CourierProvider = require('./CourierProvider');
const axios = require('axios');

class MeestCourier extends CourierProvider {
  constructor(credentials, isTestMode = false) {
    super(credentials, isTestMode);
    
    this.baseUrl = isTestMode 
      ? 'https://mwl-stage.meest.com/mwl/v2/api'
      : 'https://mwl.meest.com/mwl/v2/api';
    
    this.accessToken = null;
    this.refreshToken = null;
  }

  getProviderName() {
    return 'meest';
  }

  async authenticate(forceRefresh = false) {
    // TODO: Implement Meest authentication
    console.log('⚠️ Meest authentication not yet implemented');
    throw new Error('Meest courier is not yet implemented. Please use Geniki for now.');
  }

  async createVoucher(orderData) {
    // TODO: Implement Meest voucher creation
    throw new Error('Meest courier is not yet implemented. Please use Geniki for now.');
  }

  async getVoucherPdf(voucherNumber) {
    // TODO: Implement Meest PDF retrieval
    throw new Error('Meest courier is not yet implemented. Please use Geniki for now.');
  }

  async getMultipleVouchersPdf(voucherNumbers) {
    // TODO: Implement Meest multiple PDF retrieval
    throw new Error('Meest courier is not yet implemented. Please use Geniki for now.');
  }

  async cancelVoucher(voucherNumber) {
    // TODO: Implement Meest cancellation
    throw new Error('Meest courier is not yet implemented. Please use Geniki for now.');
  }

  async trackVoucher(voucherNumber) {
    // TODO: Implement Meest tracking
    throw new Error('Meest courier is not yet implemented. Please use Geniki for now.');
  }

  async finalizeShipments(date = new Date()) {
    // TODO: Implement Meest manifest creation
    throw new Error('Meest courier is not yet implemented. Please use Geniki for now.');
  }
}

module.exports = MeestCourier;
```

**Testing:**
```bash
node -c server/couriers/MeestCourier.js
```

**Success Criteria:**
- ✅ File has no syntax errors
- ✅ Can be required without crashing
- ✅ Throws helpful error messages when called

---

### Step 2.6: Update Database Helper Functions (Non-Breaking)
**Time Estimate:** 15 minutes  
**Risk Level:** 🟢 Low (adding optional parameters)

In `server.js`, update workspace functions to handle courier fields:

```javascript
// Update getWorkspace to include courier fields
async function getWorkspace(workspaceId) {
  const query = `
    SELECT 
      workspace_id, 
      workspace_name, 
      store_name, 
      store_url, 
      country,
      shopify_access_token, 
      shopify_shop, 
      is_active,
      courier_provider,
      courier_credentials,
      created_at, 
      updated_at
    FROM workspaces
    WHERE workspace_id = $1
  `;
  const result = await pool.query(query, [workspaceId]);
  return result.rows[0];
}

// Update updateWorkspace to handle courier fields
async function updateWorkspace(workspaceId, workspaceData) {
  const { 
    workspace_name, 
    store_name, 
    store_url, 
    country, 
    shopify_access_token, 
    shopify_shop, 
    is_active,
    courier_provider,
    courier_credentials
  } = workspaceData;
  
  const query = `
    UPDATE workspaces
    SET workspace_name = COALESCE($1, workspace_name),
        store_name = COALESCE($2, store_name),
        store_url = COALESCE($3, store_url),
        country = COALESCE($4, country),
        shopify_access_token = COALESCE($5, shopify_access_token),
        shopify_shop = COALESCE($6, shopify_shop),
        is_active = COALESCE($7, is_active),
        courier_provider = COALESCE($8, courier_provider),
        courier_credentials = COALESCE($9, courier_credentials),
        updated_at = CURRENT_TIMESTAMP
    WHERE workspace_id = $10
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    workspace_name, 
    store_name, 
    store_url, 
    country, 
    shopify_access_token, 
    shopify_shop, 
    is_active,
    courier_provider,
    courier_credentials,
    workspaceId
  ]);
  
  return result.rows[0];
}
```

**Testing:**
```bash
# Restart server
npm start

# Test getting workspace
curl http://localhost:3000/api/workspaces/1 | jq .

# Should show courier_provider and courier_credentials fields
```

**Success Criteria:**
- ✅ Can fetch workspace with new fields
- ✅ Can update workspace with new fields
- ✅ Existing functionality still works

---

### Step 2.7: Integrate CourierFactory into Routes (CRITICAL STEP)
**Time Estimate:** 45 minutes  
**Risk Level:** 🟡 Medium (modifying existing routes)

**Strategy:** Add factory-based code alongside existing code, then switch gradually.

In `server.js`, add at the top:

```javascript
const CourierFactory = require('./server/couriers/CourierFactory');

// Helper function to get courier instance for a workspace
async function getCourierForWorkspace(workspaceId) {
  const workspace = await getWorkspace(workspaceId);
  
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  
  // Determine if we're in test mode based on environment
  const isTestMode = process.env.NODE_ENV !== 'production';
  
  // Create courier instance using factory
  const courier = CourierFactory.createCourier(
    workspace.courier_provider || 'geniki', // Default to Geniki
    workspace.courier_credentials || {
      username: process.env.GENIKI_USERNAME,
      password: process.env.GENIKI_PASSWORD,
      appKey: process.env.GENIKI_APPKEY
    },
    isTestMode
  );
  
  return courier;
}
```

Now, **gradually** update routes. Start with ONE route as a test:

**Update: Create Single Voucher Route**

```javascript
// OLD CODE (keep commented as backup):
// app.post('/api/imported-orders/:orderId/voucher', async (req, res) => {
//   ... existing code ...
// });

// NEW CODE (factory-based):
app.post('/api/imported-orders/:orderId/voucher', async (req, res) => {
  try {
    const { orderId } = req.params;
    const workspaceId = req.headers['x-workspace-id'] || 1;
    
    console.log(`🎫 Creating voucher for order ${orderId} in workspace ${workspaceId}`);
    
    // Get order data
    const orderData = await getOrder(orderId, workspaceId);
    if (!orderData) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get courier instance for this workspace
    const courier = await getCourierForWorkspace(workspaceId);
    console.log(`📦 Using courier: ${courier.getProviderName()}`);
    
    // Create voucher using courier provider
    const result = await courier.createVoucher(orderData);
    
    // Save voucher to database
    await insertVoucher({
      orderName: orderData.order_name,
      voucherNumber: result.voucherNumber,
      jobId: result.jobId,
      workspaceId: workspaceId,
      status: 'created'
    });
    
    console.log(`✅ Voucher created: ${result.voucherNumber}`);
    
    res.json({
      success: true,
      message: `Voucher created successfully using ${courier.getProviderName()}`,
      voucherNumber: result.voucherNumber,
      jobId: result.jobId,
      provider: courier.getProviderName()
    });
  } catch (error) {
    console.error('❌ Voucher creation failed:', error.message);
    res.status(500).json({ 
      error: 'Voucher creation failed', 
      details: error.message 
    });
  }
});
```

**Testing:**
```bash
# Restart server
npm start

# Test creating a voucher (should use Geniki via factory)
curl -X POST http://localhost:3000/api/imported-orders/CLO%231347GR/voucher \
  -H "x-workspace-id: 1" | jq .

# Should see:
# - "Using courier: geniki" in server logs
# - "provider": "geniki" in response
# - Voucher created successfully
```

**Success Criteria:**
- ✅ Voucher creation works via CourierFactory
- ✅ Server logs show "Using courier: geniki"
- ✅ Response includes provider name
- ✅ Voucher appears in database and UI

**If this works, continue updating other routes one by one:**

1. **GET Voucher PDF** (`/api/imported-orders/:orderId/download-voucher`)
2. **Export Labels** (`/api/export-labels`)
3. **Send Labels** (`/api/send-labels`)
4. **Cancel Voucher** (if exists)

**Test each route after updating it!**

---

## Phase 3: Frontend Updates (Non-Breaking)

### Step 3.1: Add Courier Fields to Settings UI
**Time Estimate:** 30 minutes  
**Risk Level:** 🟢 Low (UI additions only)

Update `public/index.html`, add to System Settings:

```html
<!-- In System Settings tab, add new section -->
<div class="settings-section">
    <h3 class="settings-section-title">
        <i data-feather="truck" style="width: 20px; height: 20px;"></i>
        Courier Configuration
    </h3>
    
    <div class="form-group">
        <label class="form-label">Courier Provider *</label>
        <select id="settingsCourierProvider" class="form-select">
            <option value="geniki">Geniki Taxydromiki (Greece)</option>
            <option value="meest">Meest (Poland, Romania, Hungary, etc.) - Coming Soon</option>
        </select>
        <span class="form-help">Select your preferred shipping courier for this workspace</span>
    </div>
    
    <!-- Geniki Credentials -->
    <div id="geinikiCredentials" class="courier-credentials-section">
        <div class="form-group">
            <label class="form-label">Geniki Username</label>
            <input type="text" id="geinikiUsername" class="form-input" placeholder="Your Geniki username">
        </div>
        <div class="form-group">
            <label class="form-label">Geniki Password</label>
            <input type="password" id="geinikiPassword" class="form-input" placeholder="Your Geniki password">
        </div>
        <div class="form-group">
            <label class="form-label">Geniki App Key</label>
            <input type="text" id="geinikiAppKey" class="form-input" placeholder="Your Geniki application key">
        </div>
    </div>
    
    <!-- Meest Credentials (hidden by default) -->
    <div id="meestCredentials" class="courier-credentials-section hidden">
        <div class="alert alert-info">
            <i data-feather="info"></i>
            <span>Meest integration is coming soon! For now, please use Geniki.</span>
        </div>
        <div class="form-group">
            <label class="form-label">Meest Partner Key</label>
            <input type="text" id="meestPartnerKey" class="form-input" placeholder="Your Meest partner key" disabled>
        </div>
        <div class="form-group">
            <label class="form-label">Meest Secret Key</label>
            <input type="password" id="meestSecretKey" class="form-input" placeholder="Your Meest secret key" disabled>
        </div>
    </div>
</div>
```

Add CSS:

```css
.courier-credentials-section {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
}

.alert {
    padding: 1rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.alert-info {
    background: #dbeafe;
    color: #1e40af;
    border: 1px solid #93c5fd;
}
```

Add JavaScript:

```javascript
// Toggle courier credentials based on selection
document.getElementById('settingsCourierProvider').addEventListener('change', function() {
    const provider = this.value;
    document.getElementById('geinikiCredentials').classList.toggle('hidden', provider !== 'geniki');
    document.getElementById('meestCredentials').classList.toggle('hidden', provider !== 'meest');
});

// Update loadWorkspaceSettings to populate courier fields
async function loadWorkspaceSettings() {
    // ... existing code ...
    
    // Load courier provider
    document.getElementById('settingsCourierProvider').value = workspace.courier_provider || 'geniki';
    
    // Trigger change event to show correct credentials section
    document.getElementById('settingsCourierProvider').dispatchEvent(new Event('change'));
    
    // Load Geniki credentials if available
    if (workspace.courier_credentials && workspace.courier_provider === 'geniki') {
        document.getElementById('geinikiUsername').value = workspace.courier_credentials.username || '';
        document.getElementById('geinikiPassword').value = workspace.courier_credentials.password || '';
        document.getElementById('geinikiAppKey').value = workspace.courier_credentials.appKey || '';
    }
    
    // Load Meest credentials if available
    if (workspace.courier_credentials && workspace.courier_provider === 'meest') {
        document.getElementById('meestPartnerKey').value = workspace.courier_credentials.partnerKey || '';
        document.getElementById('meestSecretKey').value = workspace.courier_credentials.secretKey || '';
    }
}

// Update saveWorkspaceSettings to save courier settings
async function saveWorkspaceSettings() {
    const provider = document.getElementById('settingsCourierProvider').value;
    
    let credentials = {};
    if (provider === 'geniki') {
        credentials = {
            username: document.getElementById('geinikiUsername').value,
            password: document.getElementById('geinikiPassword').value,
            appKey: document.getElementById('geinikiAppKey').value
        };
    } else if (provider === 'meest') {
        credentials = {
            partnerKey: document.getElementById('meestPartnerKey').value,
            secretKey: document.getElementById('meestSecretKey').value
        };
    }
    
    const response = await fetch(`/api/workspaces/${currentWorkspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            workspace_name: document.getElementById('settingsWorkspaceName').value,
            store_name: document.getElementById('settingsStoreName').value,
            store_url: document.getElementById('settingsStoreUrl').value,
            country: document.getElementById('settingsCountry').value,
            shopify_shop: document.getElementById('settingsShopifyShop').value,
            shopify_access_token: document.getElementById('settingsShopifyToken').value,
            is_active: document.getElementById('settingsIsActive').checked,
            courier_provider: provider,
            courier_credentials: credentials
        })
    });
    
    // ... rest of existing save code ...
}
```

**Testing:**
```bash
# Open browser: http://localhost:3000
# 1. Go to System Settings
# 2. Check courier provider dropdown exists
# 3. Switch between Geniki and Meest (Meest should show "coming soon")
# 4. Verify Geniki credentials populate from current workspace
# 5. Try saving settings
# 6. Verify database updated: SELECT courier_provider, courier_credentials FROM workspaces;
```

**Success Criteria:**
- ✅ Courier provider dropdown appears
- ✅ Geniki credentials show and save correctly
- ✅ Meest option shows "coming soon" message
- ✅ Existing settings still work

---

### Step 3.2: Add Courier Provider Indicator to UI
**Time Estimate:** 15 minutes  
**Risk Level:** 🟢 Low (visual addition only)

Add courier badge to workspace switcher and settings:

```javascript
// Update updateWorkspaceUI to show courier provider
function updateWorkspaceUI() {
    const workspace = allWorkspaces.find(w => w.workspace_id === currentWorkspaceId);
    if (!workspace) return;
    
    const flag = getCountryFlag(workspace.country);
    const provider = workspace.courier_provider || 'geniki';
    const providerEmoji = provider === 'geniki' ? '🇬🇷' : '📦';
    
    document.getElementById('currentWorkspaceName').textContent = 
        `${flag} ${workspace.workspace_name} ${providerEmoji}`;
}
```

**Testing:**
- ✅ Workspace name shows courier emoji
- ✅ Clicking workspace still works

---

## Phase 4: Meest Implementation (New Functionality)

### Step 4.1: Get Meest Test Credentials
**Time Estimate:** N/A (waiting on user)  
**Risk Level:** 🟢 Low (external dependency)

**Action Required:**
- Contact Meest account manager for staging credentials
- Get: Partner Key and Secret Key for test environment

**Testing:**
```bash
# Once credentials received, test authentication manually:
curl -X POST https://mwl-stage.meest.com/mwl/v2/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "partnerKey": "YOUR_PARTNER_KEY",
    "secretKey": "YOUR_SECRET_KEY"
  }' | jq .

# Should return: { "accessToken": "...", "refreshToken": "..." }
```

---

### Step 4.2: Implement Meest Authentication
**Time Estimate:** 20 minutes  
**Risk Level:** 🟢 Low (isolated implementation)

Update `server/couriers/MeestCourier.js`:

```javascript
async authenticate(forceRefresh = false) {
    // Check if we have a valid token
    if (!forceRefresh && this.accessToken) {
        return this.accessToken;
    }
    
    console.log('🔐 Authenticating with Meest...');
    
    try {
        const response = await axios.post(
            `${this.baseUrl}/auth`,
            {
                partnerKey: this.credentials.partnerKey,
                secretKey: this.credentials.secretKey
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        this.accessToken = response.data.accessToken;
        this.refreshToken = response.data.refreshToken;
        
        console.log('✅ Meest authentication successful');
        return this.accessToken;
    } catch (error) {
        console.error('❌ Meest authentication failed:', error.message);
        throw new Error(`Meest authentication failed: ${error.message}`);
    }
}
```

**Testing:**
```bash
# Create test file
cat > test-meest-auth.js << 'EOF'
const MeestCourier = require('./server/couriers/MeestCourier');

async function test() {
    const meest = new MeestCourier({
        partnerKey: 'YOUR_TEST_PARTNER_KEY',
        secretKey: 'YOUR_TEST_SECRET_KEY'
    }, true);
    
    try {
        const token = await meest.authenticate();
        console.log('✅ Meest authentication successful');
        console.log('Token:', token.substring(0, 30) + '...');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

test();
EOF

node test-meest-auth.js
rm test-meest-auth.js
```

**Success Criteria:**
- ✅ Authentication returns access token
- ✅ No errors thrown

---

### Step 4.3: Implement Meest Label Creation
**Time Estimate:** 45 minutes  
**Risk Level:** 🟡 Medium (complex mapping)

Update `server/couriers/MeestCourier.js`:

```javascript
async createVoucher(orderData) {
    if (!this.accessToken) {
        await this.authenticate();
    }
    
    console.log('📦 Creating Meest label...');
    
    // Map order data to Meest format
    const meestParcel = {
        recipient: {
            name: `${orderData.firstName || ''} ${orderData.lastName || ''}`.trim(),
            phone: orderData.phone || '',
            email: orderData.email || '',
            address: {
                street: orderData.address1 || '',
                city: orderData.city || '',
                zip: orderData.zip || '',
                country: orderData.country || 'GR'
            }
        },
        parcel: {
            weight: this.calculateWeight(orderData),
            description: orderData.contentsDescription || 'E-commerce package',
            codAmount: orderData.codAmount || 0,
            currency: 'EUR'
        },
        sender: {
            // Use workspace sender details (TODO: add to workspace config)
            name: 'Your Store Name',
            phone: '+30 XXX XXX XXXX',
            address: {
                street: 'Your Address',
                city: 'Your City',
                zip: 'XXXXX',
                country: 'GR'
            }
        }
    };
    
    try {
        const response = await axios.post(
            `${this.baseUrl}/label/standard`,
            meestParcel,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Meest label created:', response.data.trackingNumber);
        
        return {
            voucherNumber: response.data.trackingNumber,
            jobId: response.data.parcelId,
            pdfBase64: response.data.labelPdf // Meest returns PDF directly
        };
    } catch (error) {
        console.error('❌ Meest label creation failed:', error.message);
        throw new Error(`Meest label creation failed: ${error.message}`);
    }
}

calculateWeight(orderData) {
    // Same logic as Geniki
    return 2; // Fixed 2kg for now
}
```

**Testing:**
```bash
# Create test workspace with Meest provider
# Via SQL:
INSERT INTO workspaces (workspace_name, store_name, courier_provider, courier_credentials, country)
VALUES (
    'Test Meest Store',
    'Meest Test',
    'meest',
    '{"partnerKey":"YOUR_KEY","secretKey":"YOUR_SECRET"}',
    'PL'
);

# Then test via API (once workspace created)
curl -X POST http://localhost:3000/api/imported-orders/TEST_ORDER_ID/voucher \
  -H "x-workspace-id: MEEST_WORKSPACE_ID" | jq .
```

**Success Criteria:**
- ✅ Label created successfully
- ✅ Tracking number returned
- ✅ PDF available

---

### Step 4.4: Implement Remaining Meest Methods
**Time Estimate:** 60 minutes  
**Risk Level:** 🟡 Medium

Implement in `MeestCourier.js`:
- `getVoucherPdf()`
- `getMultipleVouchersPdf()`
- `cancelVoucher()`
- `trackVoucher()`
- `finalizeShipments()` (manifest)

Test each method individually.

---

### Step 4.5: Enable Meest in Frontend
**Time Estimate:** 10 minutes  
**Risk Level:** 🟢 Low

Remove "Coming Soon" from Meest option:

```html
<option value="meest">Meest (Poland, Romania, Hungary, etc.)</option>
```

Enable Meest credentials inputs:

```javascript
// Remove 'disabled' attribute from Meest inputs
document.getElementById('meestPartnerKey').removeAttribute('disabled');
document.getElementById('meestSecretKey').removeAttribute('disabled');
```

**Testing:**
- ✅ Can select Meest
- ✅ Can enter Meest credentials
- ✅ Can save workspace with Meest
- ✅ Can create labels with Meest

---

## Phase 5: Final Testing & Documentation

### Step 5.1: Comprehensive Testing Checklist
**Time Estimate:** 60 minutes  
**Risk Level:** 🟡 Medium (critical verification)

**Test Scenarios:**

| Test Case | Workspace | Provider | Expected Result | Status |
|-----------|-----------|----------|----------------|--------|
| 1. Create label | Existing (Geniki) | Geniki | ✅ Works as before | [ ] |
| 2. Download PDF | Existing (Geniki) | Geniki | ✅ PDF downloads | [ ] |
| 3. Export multiple labels | Existing (Geniki) | Geniki | ✅ Combined PDF | [ ] |
| 4. Send labels | Existing (Geniki) | Geniki | ✅ Finalized | [ ] |
| 5. Create new workspace | New | Geniki | ✅ Uses Geniki | [ ] |
| 6. Create new workspace | New | Meest | ✅ Uses Meest | [ ] |
| 7. Switch workspace | Different providers | Mixed | ✅ Uses correct provider | [ ] |
| 8. Update courier credentials | Existing | Geniki | ✅ Credentials saved | [ ] |
| 9. CSV import | Any workspace | Any | ✅ Orders imported | [ ] |
| 10. Pagination | Any workspace | Any | ✅ Pages work | [ ] |

---

### Step 5.2: Update Documentation
**Time Estimate:** 30 minutes  
**Risk Level:** 🟢 Low

Update `README.md` to document:
1. Multi-courier support
2. How to add new couriers
3. Provider-specific configuration
4. Troubleshooting per provider

---

### Step 5.3: Clean Up Old Code
**Time Estimate:** 30 minutes  
**Risk Level:** 🟡 Medium (removing old code)

**ONLY AFTER ALL TESTS PASS:**

1. Remove old Geniki functions from `server.js` (they're now in `GeinikiCourier.js`)
2. Remove commented-out code
3. Remove any unused dependencies
4. Consolidate duplicate helper functions

**Create backup before cleanup:**
```bash
cp server.js server.js.backup-before-cleanup
```

---

## Phase 6: Production Deployment

### Step 6.1: Environment Variables
**Time Estimate:** 15 minutes  
**Risk Level:** 🟢 Low

Update `.env`:

```env
# Geniki Production Credentials (existing)
GENIKI_USERNAME=your_prod_username
GENIKI_PASSWORD=your_prod_password
GENIKI_APPKEY=your_prod_appkey

# Meest Production Credentials (new)
MEEST_PARTNER_KEY=your_prod_partner_key
MEEST_SECRET_KEY=your_prod_secret_key

# Environment
NODE_ENV=production
```

---

### Step 6.2: Database Migration in Production
**Time Estimate:** 10 minutes  
**Risk Level:** 🟡 Medium (production DB change)

```bash
# Backup production database first!
pg_dump -U postgres geniki_shipping > backup_before_courier_migration.sql

# Run migration
psql -U postgres -d geniki_shipping < database-courier-provider-migration.sql

# Verify
psql -U postgres -d geniki_shipping -c "SELECT workspace_id, courier_provider FROM workspaces;"
```

---

### Step 6.3: Deploy to Production
**Time Estimate:** 20 minutes  
**Risk Level:** 🟡 Medium (production deployment)

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Restart server
pm2 restart geniki-app

# Monitor logs
pm2 logs geniki-app
```

---

## Rollback Plan

### If Something Goes Wrong:

#### **Phase 1-2 (Database/Backend):**
```bash
# Rollback database
psql -U postgres -d geniki_shipping < backup_before_courier_migration.sql

# Revert to previous code
git reset --hard HEAD~1
npm install
pm2 restart geniki-app
```

#### **Phase 3-4 (Frontend/Meest):**
```bash
# Just disable Meest in UI
# Set all workspaces back to Geniki:
UPDATE workspaces SET courier_provider = 'geniki';
```

#### **Phase 5-6 (Production):**
```bash
# Restore production database
psql -U postgres -d geniki_shipping < backup_before_courier_migration.sql

# Deploy previous version
git checkout <previous-stable-commit>
pm2 restart geniki-app
```

---

## Success Criteria (Final Checklist)

- [ ] All existing Geniki functionality works unchanged
- [ ] New workspaces can choose between Geniki and Meest
- [ ] Can create labels with both providers
- [ ] Can download PDFs from both providers
- [ ] Workspace switcher shows correct courier
- [ ] System Settings allows courier configuration
- [ ] Database migration successful
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Production deployment successful

---

## Timeline Estimate

| Phase | Time | Risk |
|-------|------|------|
| Phase 1: Database | 30 min | 🟢 Low |
| Phase 2: Backend Refactoring | 3 hours | 🟡 Medium |
| Phase 3: Frontend Updates | 1 hour | 🟢 Low |
| Phase 4: Meest Implementation | 3 hours | 🟡 Medium |
| Phase 5: Testing | 2 hours | 🟡 Medium |
| Phase 6: Production | 1 hour | 🟡 Medium |
| **Total** | **~10 hours** | |

---

## Notes

- **Test after each step** - Don't skip testing!
- **Keep old code commented** until new code is verified
- **Always have a rollback plan**
- **Test in production-like environment** before deploying
- **Monitor logs closely** after each phase

---

## Next Steps

1. Review this plan
2. Approve to proceed
3. Start with Phase 1, Step 1.1
4. Report any issues immediately
5. Celebrate when done! 🎉

