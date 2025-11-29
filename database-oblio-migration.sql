-- Migration: Add Oblio invoice tracking fields
-- Run this to enable Oblio invoice integration

-- Add Oblio invoice fields to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS oblio_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS oblio_series_name TEXT,
  ADD COLUMN IF NOT EXISTS oblio_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS oblio_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMP;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_oblio_invoice ON orders(oblio_invoice_id) WHERE oblio_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_invoiced ON orders(invoiced_at) WHERE invoiced_at IS NOT NULL;

-- Add Oblio credentials to workspaces table
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS oblio_email TEXT,
  ADD COLUMN IF NOT EXISTS oblio_secret TEXT,
  ADD COLUMN IF NOT EXISTS oblio_cif TEXT,
  ADD COLUMN IF NOT EXISTS oblio_series_name TEXT DEFAULT 'FCT',
  ADD COLUMN IF NOT EXISTS oblio_vat_rate DECIMAL(5,2) DEFAULT 24.00;

-- Insert Oblio credentials for CLO SKIN workspace (workspace_id = 2)
-- You can update these values as needed
UPDATE workspaces
SET 
  oblio_email = 'your-oblio-email@example.com', -- UPDATE THIS with your Oblio login email
  oblio_secret = '9b4f9d839edec2a862d77852d569f2a5d0cb695b',
  oblio_cif = 'RO51655811',
  oblio_series_name = 'FCT',
  oblio_vat_rate = 24.00
WHERE workspace_id = 2;

-- Note: Make sure to update 'oblio_email' with the actual email you use to log into Oblio!

-- Verify the migration
SELECT 
  workspace_id,
  workspace_name,
  oblio_email,
  oblio_cif,
  oblio_series_name,
  oblio_vat_rate
FROM workspaces
WHERE workspace_id = 2;


