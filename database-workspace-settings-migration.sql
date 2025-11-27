-- ============================================================================
-- Workspace Settings Migration
-- Add all workspace-specific settings for multi-tenant support
-- ============================================================================

-- Add Shopify API credentials
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS shopify_api_key TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS shopify_api_secret TEXT;

-- Add Geniki Taxydromiki credentials
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS geniki_username TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS geniki_password TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS geniki_app_key TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS geniki_wsdl_url TEXT DEFAULT 'https://voucher.taxydromiki.gr/JobServicesV2.asmx?WSDL';

-- Add invoice preferences
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS invoice_language VARCHAR(2) DEFAULT 'EN';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS invoice_currency VARCHAR(3) DEFAULT 'EUR';

-- Add shipping rules
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS shipping_threshold NUMERIC(10,2) DEFAULT 40.00;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 3.00;

-- Add timezone setting
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Athens';

-- Add default payment method
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS default_payment_method VARCHAR(50) DEFAULT 'cod';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(is_active);
CREATE INDEX IF NOT EXISTS idx_workspaces_country ON workspaces(country);

-- Add comments for documentation
COMMENT ON COLUMN workspaces.shopify_shop IS 'Shopify store URL (e.g., mystore.myshopify.com)';
COMMENT ON COLUMN workspaces.shopify_access_token IS 'Shopify Admin API access token';
COMMENT ON COLUMN workspaces.shopify_api_key IS 'Shopify API key';
COMMENT ON COLUMN workspaces.shopify_api_secret IS 'Shopify API secret';

COMMENT ON COLUMN workspaces.geniki_username IS 'Geniki Taxydromiki account username';
COMMENT ON COLUMN workspaces.geniki_password IS 'Geniki Taxydromiki account password';
COMMENT ON COLUMN workspaces.geniki_app_key IS 'Geniki Taxydromiki application key';
COMMENT ON COLUMN workspaces.geniki_wsdl_url IS 'Geniki Taxydromiki WSDL endpoint URL';

COMMENT ON COLUMN workspaces.oblio_email IS 'Oblio account email';
COMMENT ON COLUMN workspaces.oblio_cif IS 'Company CIF/CUI for Oblio';
COMMENT ON COLUMN workspaces.oblio_secret IS 'Oblio API secret key';
COMMENT ON COLUMN workspaces.oblio_series_name IS 'Oblio invoice series name';
COMMENT ON COLUMN workspaces.oblio_vat_rate IS 'VAT rate for invoices (percentage)';

COMMENT ON COLUMN workspaces.invoice_language IS 'Invoice language code (EN, EL, RO, etc.)';
COMMENT ON COLUMN workspaces.invoice_currency IS 'Invoice currency code (EUR, USD, etc.)';

COMMENT ON COLUMN workspaces.shipping_threshold IS 'Order amount for free shipping';
COMMENT ON COLUMN workspaces.shipping_cost IS 'Standard shipping cost for orders below threshold';

COMMENT ON COLUMN workspaces.timezone IS 'Workspace timezone for scheduling';
COMMENT ON COLUMN workspaces.country IS 'Default country code for the workspace';

-- Display current workspace structure
\echo '=== Workspace table structure after migration ==='
\d workspaces

-- Display current workspaces
\echo '=== Current workspaces ==='
SELECT 
  workspace_id,
  workspace_name,
  country,
  is_active,
  shopify_shop,
  oblio_series_name,
  invoice_language,
  invoice_currency,
  shipping_threshold,
  shipping_cost
FROM workspaces
ORDER BY workspace_id;

