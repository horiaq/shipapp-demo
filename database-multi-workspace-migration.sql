-- Multi-Workspace Migration
-- Adds workspace-specific configuration fields for multi-store support

-- Add workspace slug for URL-friendly identification
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS workspace_slug VARCHAR(100) UNIQUE;

-- Add Geniki Taxydromiki credentials
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS geniki_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS geniki_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS geniki_app_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS geniki_wsdl_url TEXT DEFAULT 'https://voucher.taxydromiki.gr/JobServicesV2.asmx?WSDL';

-- Add invoice settings
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS invoice_language VARCHAR(10) DEFAULT 'EN',
ADD COLUMN IF NOT EXISTS invoice_currency VARCHAR(10) DEFAULT 'EUR';

-- Add shipping rules
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS shipping_threshold DECIMAL(10,2) DEFAULT 40.00,
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 3.00;

-- Add other settings
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Athens';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(workspace_slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(is_active);

-- Update existing workspaces with default values
UPDATE workspaces 
SET workspace_slug = LOWER(REPLACE(workspace_name, ' ', '-'))
WHERE workspace_slug IS NULL;

-- Display results
SELECT 
  workspace_id,
  workspace_name,
  workspace_slug,
  invoice_language,
  invoice_currency,
  shipping_threshold,
  shipping_cost,
  timezone
FROM workspaces;

