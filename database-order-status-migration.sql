-- Order Status System Migration
-- This adds a comprehensive order_status column to track the complete order lifecycle

-- Add order_status column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status VARCHAR(50) DEFAULT 'unfulfilled';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);

-- Add a column to track if order was sent to Geniki (close pending)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS sent_to_geniki BOOLEAN DEFAULT FALSE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS sent_to_geniki_at TIMESTAMP;

-- Create index for sent_to_geniki
CREATE INDEX IF NOT EXISTS idx_vouchers_sent_to_geniki ON vouchers(sent_to_geniki);

-- Update existing orders to have correct status based on their current state
-- This is a one-time migration to set initial statuses

-- Unfulfilled: No voucher created yet
UPDATE orders o
SET order_status = 'unfulfilled'
WHERE NOT EXISTS (
  SELECT 1 FROM vouchers v 
  WHERE v.order_name = o.order_name AND v.workspace_id = o.workspace_id
);

-- AWB Created: Voucher exists but not sent
UPDATE orders o
SET order_status = 'awb_created'
WHERE EXISTS (
  SELECT 1 FROM vouchers v 
  WHERE v.order_name = o.order_name 
    AND v.workspace_id = o.workspace_id
    AND (v.sent_to_geniki = FALSE OR v.sent_to_geniki IS NULL)
)
AND o.order_status = 'unfulfilled';

-- Sent: Voucher sent to Geniki
UPDATE orders o
SET order_status = 'sent'
WHERE EXISTS (
  SELECT 1 FROM vouchers v 
  WHERE v.order_name = o.order_name 
    AND v.workspace_id = o.workspace_id
    AND v.sent_to_geniki = TRUE
)
AND o.order_status IN ('unfulfilled', 'awb_created');

-- In Transit: Has delivery status that indicates in transit
UPDATE orders o
SET order_status = 'in_transit'
FROM vouchers v
WHERE v.order_name = o.order_name
  AND v.workspace_id = o.workspace_id
  AND v.delivery_status IS NOT NULL
  AND v.delivery_status NOT ILIKE '%DELIVERED%'
  AND v.delivery_status NOT ILIKE '%RETURN%'
  AND v.sent_to_geniki = TRUE
  AND o.order_status IN ('unfulfilled', 'awb_created', 'sent');

-- Returned: Delivery status indicates return
UPDATE orders o
SET order_status = 'returned'
FROM vouchers v
WHERE v.order_name = o.order_name
  AND v.workspace_id = o.workspace_id
  AND (
    v.delivery_status ILIKE '%RETURN%' OR 
    v.current_location ILIKE '%SENDER%' OR 
    v.current_location ILIKE '%ΑΠΟΣΤΟΛ%'
  );

-- Delivered: Delivery status indicates delivered
UPDATE orders o
SET order_status = 'delivered'
FROM vouchers v
WHERE v.order_name = o.order_name
  AND v.workspace_id = o.workspace_id
  AND v.delivery_status ILIKE '%DELIVERED%'
  AND NOT (
    v.delivery_status ILIKE '%RETURN%' OR 
    v.current_location ILIKE '%SENDER%' OR 
    v.current_location ILIKE '%ΑΠΟΣΤΟΛ%'
  )
  AND o.order_status != 'returned';

-- Completed: Invoice created, Shopify synced, payment collected
UPDATE orders o
SET order_status = 'completed'
FROM vouchers v
WHERE v.order_name = o.order_name
  AND v.workspace_id = o.workspace_id
  AND o.oblio_invoice_id IS NOT NULL
  AND v.shopify_fulfillment_id IS NOT NULL
  AND v.delivered_at IS NOT NULL
  AND (o.financial_status = 'paid' OR o.payment_status = 'paid')
  AND o.order_status = 'delivered';

-- Comments explaining the status flow:
-- unfulfilled -> awb_created -> sent -> in_transit -> delivered -> completed
--                                              \-> returned


