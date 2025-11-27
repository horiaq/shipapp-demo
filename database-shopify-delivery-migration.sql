-- Migration: Add Shopify fulfillment tracking
-- Date: November 25, 2025
-- Purpose: Store Shopify fulfillment IDs to enable delivery status updates

-- Add shopify_fulfillment_id to vouchers table
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS shopify_fulfillment_id VARCHAR(50);

-- Add shopify_order_id to vouchers table if not exists
ALTER TABLE vouchers
ADD COLUMN IF NOT EXISTS shopify_order_id VARCHAR(50);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vouchers_shopify_fulfillment 
ON vouchers(shopify_fulfillment_id) WHERE shopify_fulfillment_id IS NOT NULL;

-- Add index for delivered vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_delivered 
ON vouchers(workspace_id, delivered_at) WHERE delivered_at IS NOT NULL;

-- Update orders table to ensure shopify_order_id is stored properly
ALTER TABLE orders 
ALTER COLUMN shopify_order_id TYPE VARCHAR(50);

COMMENT ON COLUMN vouchers.shopify_fulfillment_id IS 'Shopify fulfillment ID for updating delivery status';
COMMENT ON COLUMN vouchers.shopify_order_id IS 'Shopify order ID for reference';

-- Migration complete
SELECT 'Migration completed: Shopify delivery tracking fields added' AS status;

