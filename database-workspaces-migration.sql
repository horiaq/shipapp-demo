-- Migration script to add multi-workspace support
-- Run this after your existing database-setup.sql

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id SERIAL PRIMARY KEY,
  workspace_name VARCHAR(255) NOT NULL UNIQUE,
  store_name VARCHAR(255),
  store_url VARCHAR(255),
  shopify_access_token TEXT,
  shopify_shop VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Add workspace_id to existing tables
ALTER TABLE orders ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(workspace_id) ON DELETE CASCADE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(workspace_id) ON DELETE CASCADE;
ALTER TABLE csv_imports ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(workspace_id) ON DELETE CASCADE;

-- Create default workspace for existing data
INSERT INTO workspaces (workspace_name, store_name, store_url, is_active)
VALUES ('Default Store', 'Clo Skin', 'g29vxb-iz.myshopify.com', TRUE)
ON CONFLICT (workspace_name) DO NOTHING;

-- Update existing records to use default workspace
UPDATE orders SET workspace_id = (SELECT workspace_id FROM workspaces WHERE workspace_name = 'Default Store' LIMIT 1)
WHERE workspace_id IS NULL;

UPDATE vouchers SET workspace_id = (SELECT workspace_id FROM workspaces WHERE workspace_name = 'Default Store' LIMIT 1)
WHERE workspace_id IS NULL;

UPDATE csv_imports SET workspace_id = (SELECT workspace_id FROM workspaces WHERE workspace_name = 'Default Store' LIMIT 1)
WHERE workspace_id IS NULL;

-- Make workspace_id NOT NULL after setting default values
ALTER TABLE orders ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE vouchers ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE csv_imports ALTER COLUMN workspace_id SET NOT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_workspace ON orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_workspace ON vouchers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_csv_imports_workspace ON csv_imports(workspace_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspace_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION update_workspace_timestamp();

COMMENT ON TABLE workspaces IS 'Stores information for multiple stores/workspaces';
COMMENT ON COLUMN workspaces.workspace_id IS 'Primary key for workspace';
COMMENT ON COLUMN workspaces.workspace_name IS 'Unique name for the workspace';
COMMENT ON COLUMN workspaces.store_name IS 'Display name of the store';
COMMENT ON COLUMN workspaces.store_url IS 'Shopify store URL';
COMMENT ON COLUMN workspaces.shopify_access_token IS 'Optional: Store-specific Shopify access token';
COMMENT ON COLUMN workspaces.is_active IS 'Whether the workspace is active';

