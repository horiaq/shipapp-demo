'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, ShoppingBag, Activity, Package, XCircle } from 'react-feather';
import { Order } from '@/lib/types';
import { useWorkspace } from '@/lib/contexts/WorkspaceContext';
import { getCurrencySymbol } from '@/lib/utils/orderHelpers';
import { cancelOrder } from '@/lib/api/orders';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

export default function OrderDetailsModal({ order, isOpen, onClose, onOrderUpdated }: OrderDetailsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.invoice_currency || 'EUR';
  const currencySymbol = getCurrencySymbol(currency);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!mounted || !order) return null;

  // Parse products from JSON if it's a string
  const products = typeof order.products === 'string' 
    ? JSON.parse(order.products) 
    : (order.products || []);

  // Calculate total
  const total = products.reduce((sum: number, prod: any) => sum + (prod.price * (prod.quantity || 1)), 0);

  // Build timeline based on order status
  const timeline = buildTimeline(order);

  // Check if order is already cancelled
  const isCancelled = order.orderStatus === 'cancelled';

  // Handle cancel order
  const handleCancelOrder = async () => {
    if (!currentWorkspace || !order) return;

    const confirmed = confirm(
      `Are you sure you want to cancel order ${order.orderName}?\n\n` +
      `This will exclude it from revenue calculations and mark it as cancelled. This action cannot be undone.`
    );

    if (!confirmed) return;

    setCancelling(true);
    try {
      const result = await cancelOrder(order.orderName, currentWorkspace.workspace_id);
      
      if (result.success) {
        alert(`Order ${order.orderName} has been cancelled successfully.`);
        onClose();
        if (onOrderUpdated) {
          onOrderUpdated(); // Refresh the orders list
        }
      } else {
        alert(`Failed to cancel order: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Error cancelling order: ${error.message}`);
    } finally {
      setCancelling(false);
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return createPortal(
    <div 
      className={`modal-overlay ${isOpen ? 'active' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-title">
            <h2>{order.orderName}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Placed on {formatDate(order.importedAt)}
            </div>
          </div>
          <div className="modal-close" onClick={onClose}>
            <X size={18} />
          </div>
        </div>

        <div className="modal-body">
          {/* Left Column: Details */}
          <div className="modal-left">
            <div className="modal-section-title">
              <User size={14} />
              Customer Details
            </div>
            <div className="info-card" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  {order.firstName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {order.firstName} {order.lastName}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {order.email}
                  </div>
                </div>
              </div>
              <div className="info-label">Shipping Address</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                {order.address1}
                {order.address2 && <>, {order.address2}</>}
                <br />
                {order.city}, {order.zip}
                {order.country && <>, {order.country}</>}
              </div>
              {order.phone && (
                <>
                  <div className="info-label" style={{ marginTop: '1rem' }}>Phone</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {order.phone}
                  </div>
                </>
              )}
            </div>

            <div className="modal-section-title">
              <ShoppingBag size={14} />
              Order Contents
            </div>
            <div className="product-list">
              {products.map((prod: any, index: number) => (
                <div key={index} className="product-item">
                  <div className="product-icon">
                    <Package size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                      {prod.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Qty: {prod.quantity || 1}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {currencySymbol}{((prod.price || 0) * (prod.quantity || 1)).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="info-card"
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Total Amount</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                {currencySymbol}{total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Right Column: Timeline */}
          <div className="modal-right">
            <div className="modal-section-title">
              <Activity size={14} />
              Order History
            </div>
            <div className="timeline-vertical">
              {timeline.map((event, index) => (
                <div
                  key={index}
                  className={`timeline-step ${event.completed ? 'completed' : ''} ${event.current ? 'current' : ''}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="step-dot"></div>
                  <div className="step-content">
                    <div className="step-title">{event.title}</div>
                    <div className="step-date">{event.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
            {order.oblioInvoiceUrl && (
              <a
                href={order.oblioInvoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)',
                  boxShadow: 'none',
                  textDecoration: 'none',
                }}
              >
                Download Invoice
              </a>
            )}
            {order.voucherNumber && (
              <button
                className="action-btn"
                onClick={() => {
                  // Track order functionality
                  alert(`Tracking voucher: ${order.voucherNumber}`);
                }}
              >
                Track Order
              </button>
            )}
          </div>
          {!isCancelled && (
            <button
              className="action-btn"
              onClick={handleCancelOrder}
              disabled={cancelling}
              style={{
                background: 'transparent',
                border: '1px solid #ef4444',
                color: '#ef4444',
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <XCircle size={16} />
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}
          {isCancelled && (
            <div
              style={{
                padding: '0.5rem 1rem',
                background: '#fee2e2',
                color: '#dc2626',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Order Cancelled
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Helper function to build timeline based on order status
function buildTimeline(order: Order) {
  const timeline = [];
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if order is cancelled
  const isCancelled = order.orderStatus === 'cancelled';

  // Order placed
  timeline.push({
    title: 'Order Placed',
    date: formatDate(order.importedAt),
    completed: true,
  });

  // If cancelled, show that and stop
  if (isCancelled) {
    timeline.push({
      title: 'Order Cancelled',
      date: 'Cancelled',
      completed: true,
      current: true,
    });
    return timeline;
  }

  // Voucher created
  if (order.voucherNumber) {
    timeline.push({
      title: 'Label Created',
      date: order.voucherCreated ? formatDate(order.voucherCreated) : 'Completed',
      completed: true,
    });
  }

  // Delivery status
  if (order.deliveryStatus) {
    const status = order.deliveryStatus.toUpperCase();
    
    if (status.includes('DELIVERED') && !status.includes('RETURN')) {
      timeline.push({
        title: 'Out for Delivery',
        date: order.deliveryStatusUpdatedAt ? formatDate(order.deliveryStatusUpdatedAt) : 'Completed',
        completed: true,
      });
      timeline.push({
        title: 'Delivered',
        date: order.deliveredAt ? formatDate(order.deliveredAt) : formatDate(order.deliveryStatusUpdatedAt),
        completed: true,
        current: true,
      });
    } else if (status.includes('RETURN')) {
      timeline.push({
        title: 'Returned to Sender',
        date: formatDate(order.deliveryStatusUpdatedAt),
        completed: true,
        current: true,
      });
    } else {
      timeline.push({
        title: 'In Transit',
        date: formatDate(order.deliveryStatusUpdatedAt),
        completed: true,
        current: true,
      });
    }
  } else if (order.voucherNumber) {
    timeline.push({
      title: 'Awaiting Pickup',
      date: 'Pending',
      completed: false,
      current: true,
    });
  }

  // Invoice created
  if (order.oblioInvoiceNumber) {
    timeline.push({
      title: 'Invoice Created',
      date: order.invoicedAt ? formatDate(order.invoicedAt) : 'Completed',
      completed: true,
    });
  }

  // Shopify synced
  if (order.fulfillmentStatus === 'fulfilled') {
    timeline.push({
      title: 'Synced with Shopify',
      date: 'Completed',
      completed: true,
    });
  }

  return timeline;
}

