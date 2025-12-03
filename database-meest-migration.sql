-- ============================================================================
-- Meest Courier Integration Migration
-- Add Meest credentials, shipping defaults, and courier tracking columns
-- ============================================================================
-- Run with: psql -U your_user -d your_database -f database-meest-migration.sql

-- ============================================================================
-- 1. Default Courier Selection
-- ============================================================================

-- Add default courier selection to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS default_courier VARCHAR(20) DEFAULT 'geniki';

COMMENT ON COLUMN workspaces.default_courier IS 'Default courier for creating vouchers: geniki, meest';

-- ============================================================================
-- 2. Meest Credentials (some may already exist from frontend placeholders)
-- ============================================================================

-- Meest API credentials
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_username VARCHAR(255);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_password VARCHAR(255);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_api_key VARCHAR(255);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN workspaces.meest_username IS 'Meest API username';
COMMENT ON COLUMN workspaces.meest_password IS 'Meest API password';
COMMENT ON COLUMN workspaces.meest_api_key IS 'Meest API key (optional)';
COMMENT ON COLUMN workspaces.meest_enabled IS 'Whether Meest integration is enabled';

-- ============================================================================
-- 3. Meest Shipping Defaults
-- ============================================================================

-- Default service type
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_default_service VARCHAR(50) DEFAULT 'ECONOMIC_STANDARD';

-- Default parcel dimensions
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_default_weight DECIMAL(10,2) DEFAULT 1.0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_default_width DECIMAL(10,2) DEFAULT 20.0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_default_height DECIMAL(10,2) DEFAULT 15.0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_default_length DECIMAL(10,2) DEFAULT 30.0;

-- COD handling mode
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meest_cod_handling VARCHAR(20) DEFAULT 'auto';

COMMENT ON COLUMN workspaces.meest_default_service IS 'Default Meest service: ECONOMIC_STANDARD, CARGO, COLLECT_BOX';
COMMENT ON COLUMN workspaces.meest_default_weight IS 'Default parcel weight in kg';
COMMENT ON COLUMN workspaces.meest_default_width IS 'Default parcel width in cm';
COMMENT ON COLUMN workspaces.meest_default_height IS 'Default parcel height in cm';
COMMENT ON COLUMN workspaces.meest_default_length IS 'Default parcel length in cm';
COMMENT ON COLUMN workspaces.meest_cod_handling IS 'COD handling: auto (detect from payment), always, never';

-- ============================================================================
-- 4. Voucher Courier Tracking
-- ============================================================================

-- Add courier type to vouchers table to track which courier was used
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS courier_type VARCHAR(20) DEFAULT 'geniki';

COMMENT ON COLUMN vouchers.courier_type IS 'Which courier created this voucher: geniki, meest';

-- Create index for courier type queries
CREATE INDEX IF NOT EXISTS idx_vouchers_courier_type ON vouchers(courier_type);

-- ============================================================================
-- 5. Verification
-- ============================================================================

-- Display added columns
\echo '=== Meest columns added to workspaces table ==='
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'workspaces'
AND column_name LIKE '%meest%' OR column_name = 'default_courier'
ORDER BY column_name;

\echo '=== Courier type column added to vouchers table ==='
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'vouchers'
AND column_name = 'courier_type';

\echo '=== Migration complete ==='
