-- Geniki Taxydromiki Database Setup
-- Run this in PostgreSQL to create the required tables

-- Create database (run this first as superuser)
-- CREATE DATABASE geniki_orders;

-- Connect to the database and run the rest

-- Orders table - stores imported order data
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_name VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255),
    financial_status VARCHAR(50),
    fulfillment_status VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    shipping_address1 VARCHAR(255),
    shipping_address2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_province VARCHAR(100),
    shipping_zip VARCHAR(20),
    shipping_country VARCHAR(100) DEFAULT 'Greece',
    shipping_country_code VARCHAR(10) DEFAULT 'GR',
    shipping_phone VARCHAR(50),
    billing_address1 VARCHAR(255),
    billing_address2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_zip VARCHAR(20),
    billing_phone VARCHAR(50),
    total_price DECIMAL(10,2),
    payment_method VARCHAR(100),
    line_items TEXT,
    notes TEXT,
    shopify_order_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE
);

-- Vouchers table - stores created Geniki vouchers
CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    order_name VARCHAR(100) NOT NULL,
    job_id INTEGER,
    voucher_number VARCHAR(100) NOT NULL,
    customer_name VARCHAR(200),
    shipping_address TEXT,
    phone VARCHAR(50),
    cod_amount DECIMAL(10,2),
    weight DECIMAL(5,2),
    services VARCHAR(100),
    status VARCHAR(50) DEFAULT 'created',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geniki_response JSONB,
    pdf_downloaded BOOLEAN DEFAULT FALSE
);

-- CSV Imports table - tracks import history
CREATE TABLE IF NOT EXISTS csv_imports (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    total_rows INTEGER,
    successful_imports INTEGER,
    failed_imports INTEGER,
    errors TEXT,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    import_summary JSONB
);

-- Processing Jobs table - tracks bulk operations
CREATE TABLE IF NOT EXISTS processing_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50), -- 'bulk_vouchers', 'close_pending', etc.
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
    total_orders INTEGER,
    successful INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    results JSONB,
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_order_name ON orders(order_name);
CREATE INDEX IF NOT EXISTS idx_orders_processed ON orders(processed);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_order_name ON vouchers(order_name);
CREATE INDEX IF NOT EXISTS idx_vouchers_voucher_number ON vouchers(voucher_number);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_at ON vouchers(created_at);

-- Create a view for easy order-voucher joining
CREATE OR REPLACE VIEW orders_with_vouchers AS
SELECT 
    o.*,
    v.id as voucher_id,
    v.job_id,
    v.voucher_number,
    v.status as voucher_status,
    v.created_at as voucher_created_at,
    v.cod_amount,
    v.weight,
    v.services
FROM orders o
LEFT JOIN vouchers v ON o.id = v.order_id
ORDER BY o.created_at DESC;

-- Sample queries for common operations:
-- 
-- Get all orders without vouchers:
-- SELECT * FROM orders WHERE NOT processed;
--
-- Get order with its voucher:
-- SELECT * FROM orders_with_vouchers WHERE order_name = 'CLO#1234GR';
--
-- Get daily voucher statistics:
-- SELECT DATE(created_at), COUNT(*), SUM(cod_amount) 
-- FROM vouchers 
-- WHERE created_at >= CURRENT_DATE 
-- GROUP BY DATE(created_at);


