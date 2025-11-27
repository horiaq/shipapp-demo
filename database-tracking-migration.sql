-- Migration: Add tracking status fields to vouchers table
-- Date: 2025-11-24
-- Purpose: Enable tracking of voucher delivery status from Geniki API

-- Add tracking status columns to vouchers table
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS delivery_status_code VARCHAR(10);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS delivery_status_updated_at TIMESTAMP;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS current_location VARCHAR(255);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS tracking_checkpoints JSONB;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS last_tracking_error TEXT;

-- Add index for faster queries on delivery status
CREATE INDEX IF NOT EXISTS idx_vouchers_delivery_status ON vouchers(delivery_status);
CREATE INDEX IF NOT EXISTS idx_vouchers_delivery_status_updated_at ON vouchers(delivery_status_updated_at);

-- Add comments for documentation
COMMENT ON COLUMN vouchers.delivery_status IS 'Human-readable delivery status (e.g., In Transit, Delivered, Returned)';
COMMENT ON COLUMN vouchers.delivery_status_code IS 'Geniki API status code';
COMMENT ON COLUMN vouchers.delivery_status_updated_at IS 'Last time tracking status was updated';
COMMENT ON COLUMN vouchers.delivered_at IS 'Timestamp when package was delivered';
COMMENT ON COLUMN vouchers.current_location IS 'Current location/shop code of the package';
COMMENT ON COLUMN vouchers.tracking_checkpoints IS 'JSON array of all tracking checkpoints from Geniki';
COMMENT ON COLUMN vouchers.last_tracking_error IS 'Last error message when updating tracking status';

-- Create a table to track the last sync time
CREATE TABLE IF NOT EXISTS tracking_sync_log (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(workspace_id),
    sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_completed_at TIMESTAMP,
    vouchers_checked INTEGER DEFAULT 0,
    vouchers_updated INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running', -- running, completed, failed
    error_message TEXT
);

-- Add index for tracking sync log
CREATE INDEX IF NOT EXISTS idx_tracking_sync_log_workspace ON tracking_sync_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sync_log_started ON tracking_sync_log(sync_started_at DESC);

COMMENT ON TABLE tracking_sync_log IS 'Log of tracking status sync operations';

