'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Order } from '@/lib/types';
import { getOrderStatus, formatPrice, getPaymentMethod, canCreateInvoice, canFulfill } from '@/lib/utils/orderHelpers';
import { fulfillOrder, trackOrder, syncOrderStatus, createInvoice, createVoucher } from '@/lib/api/orders';
import { useWorkspace } from '@/lib/contexts/WorkspaceContext';
import { CreditCard, DollarSign, FileText, Truck, RefreshCw, FilePlus, CheckCircle, Eye, Filter, ChevronDown, Edit2, Trash2, Copy, Check } from 'react-feather';
import CustomTooltip from './CustomTooltip';
import OrderDetailsModal from './OrderDetailsModal';

interface OrdersTableProps {
  orders: Order[];
  loading: boolean;
  selectedOrders: string[];
  onSelectOrders: (orderIds: string[]) => void;
  onRefresh: () => void;
  totalOrders: number;
  onFilterChange?: (status: string) => void;
  currentFilter?: string;
}

export default function OrdersTable({
  orders,
  loading,
  selectedOrders,
  onSelectOrders,
  onRefresh,
  totalOrders,
  onFilterChange,
  currentFilter: externalFilter = 'All',
}: OrdersTableProps) {
  const { currentWorkspace } = useWorkspace();
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const currentFilter = externalFilter;
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredVoucher, setHoveredVoucher] = useState<string | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [mounted, setMounted] = useState(false);
  const leaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Animate tooltip appearance
  React.useEffect(() => {
    if (hoveredVoucher) {
      // Reset animation first, then trigger it
      setShowTooltip(false);
      const timer = setTimeout(() => setShowTooltip(true), 10);
      return () => clearTimeout(timer);
    } else {
      setShowTooltip(false);
    }
  }, [hoveredVoucher]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectOrders(orders.map((o) => o.orderName));
    } else {
      onSelectOrders([]);
    }
  };

  const handleSelectOrder = (orderName: string, index: number, shiftKey: boolean) => {
    if (shiftKey && lastCheckedIndex !== null) {
      // Shift-click: select range
      const start = Math.min(lastCheckedIndex, index);
      const end = Math.max(lastCheckedIndex, index);
      const rangeOrderNames = orders.slice(start, end + 1).map((o) => o.orderName);
      
      // Add all orders in range to selection
      const newSelection = [...new Set([...selectedOrders, ...rangeOrderNames])];
      onSelectOrders(newSelection);
      setLastCheckedIndex(index);
    } else {
      // Normal click: toggle single order
      if (selectedOrders.includes(orderName)) {
        onSelectOrders(selectedOrders.filter((id) => id !== orderName));
      } else {
        onSelectOrders([...selectedOrders, orderName]);
      }
      setLastCheckedIndex(index);
    }
  };

  const handleAction = async (
    action: () => Promise<any>,
    orderName: string,
    successMessage: string
  ) => {
    if (!currentWorkspace) return;

    setActionLoading({ ...actionLoading, [orderName]: true });
    try {
      const result = await action();
      if (result.success) {
        alert(successMessage);
        onRefresh();
      } else {
        alert(`Error: ${result.message || 'Action failed'}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setActionLoading({ ...actionLoading, [orderName]: false });
    }
  };

  const filterOrders = (status: string) => {
    setFilterOpen(false);
    if (onFilterChange) {
      onFilterChange(status);
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedOrder(null), 300); // Wait for animation to complete
  };

  const handleCopyVoucher = async (voucherNumber: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(voucherNumber);
      setCopiedVoucher(voucherNumber);
      
      setTimeout(() => {
        setCopiedVoucher(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleVoucherMouseEnter = (voucherNumber: string, e: React.MouseEvent) => {
    // Clear any pending leave timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    
    setHoveredVoucher(voucherNumber);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  const handleVoucherMouseLeave = (e: React.MouseEvent) => {
    // Clear any existing timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
    }
    
    // Add a small delay to allow moving to the tooltip
    leaveTimeoutRef.current = setTimeout(() => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!relatedTarget || !relatedTarget.closest('.voucher-tooltip')) {
        setHoveredVoucher(null);
        setCopiedVoucher(null);
      }
      leaveTimeoutRef.current = null;
    }, 100);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setFilterOpen(false);
    if (filterOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [filterOpen]);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading orders...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No orders found
      </div>
    );
  }

  return (
    <>
      {/* Table Header */}
      <div className="table-header">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h3 className="chart-title">All Orders</h3>
          <span
            style={{
              background: 'rgba(6, 182, 212, 0.1)',
              color: 'var(--primary)',
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {totalOrders.toLocaleString()} Total
          </span>
        </div>
        <div className="header-actions">
          <div className="filter-dropdown-container" style={{ position: 'relative' }}>
            <button
              className="action-btn"
              id="filterBtn"
              onClick={(e) => {
                e.stopPropagation();
                setFilterOpen(!filterOpen);
              }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-muted)',
                padding: '0.5rem 1rem',
                minWidth: '160px',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={14} />
                <span id="currentFilterLabel">Status: {currentFilter}</span>
              </span>
              <ChevronDown
                size={14}
                className="filter-chevron"
                style={{
                  width: '14px',
                  transform: filterOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease',
                }}
              />
            </button>
            <div
              className={`bulk-dropdown ${filterOpen ? 'show' : ''}`}
              id="filterDropdown"
              style={{ width: '100%', minWidth: '160px' }}
            >
              <div className="bulk-item" onClick={() => filterOrders('All')}>
                All Statuses
              </div>
              <div className="bulk-item" onClick={() => filterOrders('Unfulfilled')}>
                <span
                  className="status-badge status-unfulfilled"
                  style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                >
                  Unfulfilled
                </span>
              </div>
              <div className="bulk-item" onClick={() => filterOrders('AWB Created')}>
                <span
                  className="status-badge status-awb_created"
                  style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                >
                  AWB Created
                </span>
              </div>
              <div className="bulk-item" onClick={() => filterOrders('Sent')}>
                <span
                  className="status-badge status-sent"
                  style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                >
                  Sent
                </span>
              </div>
              <div className="bulk-item" onClick={() => filterOrders('In Transit')}>
                <span
                  className="status-badge status-in_transit"
                  style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                >
                  In Transit
                </span>
              </div>
              <div className="bulk-item" onClick={() => filterOrders('Delivered')}>
                <span
                  className="status-badge status-delivered"
                  style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                >
                  Delivered
                </span>
              </div>
              <div className="bulk-item" onClick={() => filterOrders('Returned')}>
                <span
                  className="status-badge status-returned"
                  style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                >
                  Returned
                </span>
              </div>
              <div className="bulk-item" onClick={() => filterOrders('Completed')}>
                <span
                  className="status-badge status-completed"
                  style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                >
                  Completed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="table-wrapper">
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: '40px' }}>
              <input
                type="checkbox"
                checked={selectedOrders.length === orders.length}
                onChange={handleSelectAll}
                style={{ cursor: 'pointer' }}
              />
            </th>
            <th style={{ width: '120px' }}>Order</th>
            <th style={{ width: '180px' }}>Customer</th>
            <th style={{ width: '150px' }}>Address</th>
            <th style={{ width: '200px' }}>Products</th>
            <th style={{ width: '110px' }}>Amount</th>
            <th style={{ width: '120px' }}>Status</th>
            <th style={{ width: '140px' }}>Documents</th>
            <th style={{ width: '200px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => {
            const status = getOrderStatus(order);
            const paymentMethod = getPaymentMethod(order.financialStatus);
            const isLoading = actionLoading[order.orderName];

            return (
              <tr key={order.orderName}>
                {/* Checkbox */}
                <td>
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(order.orderName)}
                    onChange={() => {}}
                    onMouseDown={(e) => {
                      handleSelectOrder(order.orderName, index, e.shiftKey);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </td>

                {/* Order Name */}
                <td style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
                  {order.orderName}
                </td>

                {/* Customer */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ 
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {order.firstName} {order.lastName}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {order.email}
                    </div>
                  </div>
                </td>

                {/* Address with Tooltip */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
                    {order.address1 && order.address1.length < 5 && (
                      <div 
                        className="address-warning-dot"
                        data-tooltip="⚠️ Address too short"
                        style={{
                          width: '8px',
                          height: '8px',
                          minWidth: '8px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.1), 0 0 8px rgba(239, 68, 68, 0.3)',
                          flexShrink: 0,
                          animation: 'pulse-red 2s ease-in-out infinite',
                          cursor: 'help',
                          position: 'relative',
                        }}
                      />
                    )}
                    <CustomTooltip
                      type="address"
                      data={{
                        address1: order.address1,
                        address2: order.address2,
                        city: order.city,
                        zip: order.zip,
                        country: order.country,
                        phone: order.phone,
                      }}
                      trigger={
                        <div
                          style={{
                            width: '100%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: order.address1 && order.address1.length < 5 ? '#ef4444' : 'var(--text-muted)',
                            fontSize: '0.8rem',
                            cursor: 'help',
                          }}
                        >
                          {order.address1}
                        </div>
                      }
                    />
                  </div>
                </td>

                {/* Products with Tooltip */}
                <td>
                  <CustomTooltip
                    type="products"
                    data={{ products: order.products }}
                    trigger={
                      <div style={{ cursor: 'help', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          <span style={{ 
                            fontSize: '0.875rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                            display: 'block'
                          }}>
                            {order.products && order.products.length > 0
                              ? `${order.products[0].quantity}x ${order.products[0].name || (order.products[0] as any).title || 'Product'}`
                              : 'No products'}
                          </span>
                          {order.products && order.products.length > 1 && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              + {order.products.length - 1} {order.products.length === 2 ? 'item' : 'items'}
                            </span>
                          )}
                        </div>
                      </div>
                    }
                  />
                </td>

                {/* Amount with Payment Badge */}
                <td style={{ fontWeight: 600 }}>
                  <div className="amount-wrapper">
                    {formatPrice(order.totalPrice)}
                    <div
                      className={`payment-badge ${paymentMethod}`}
                      data-tooltip={paymentMethod === 'card' ? 'Paid by Card' : 'Cash on Delivery'}
                    >
                      {paymentMethod === 'card' ? <CreditCard size={11} /> : <DollarSign size={11} />}
                    </div>
                  </div>
                </td>

                {/* Status with Tooltip */}
                <td>
                  <CustomTooltip
                    type="status"
                    data={{
                      importedAt: order.importedAt,
                      voucherCreatedAt: order.voucherCreated,
                      deliveredAt: order.deliveredAt,
                      invoicedAt: order.invoicedAt,
                    }}
                    trigger={
                      <span className={`status-badge status-${status.toLowerCase().replace(/\s+/g, '_')}`}>
                        {status}
                      </span>
                    }
                  />
                </td>

                {/* Documents */}
                <td>
                  <div className="doc-group">
                    {/* Invoice Badge */}
                    {order.oblioInvoiceNumber ? (
                      <a
                        key={`doc-invoice-${order.orderName}`}
                        href={order.oblioInvoiceUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="doc-badge doc-invoice"
                        data-tooltip={`Invoice: ${order.oblioSeriesName}-${order.oblioInvoiceNumber}`}
                      >
                        <FileText size={14} />
                      </a>
                    ) : status === 'Completed' ? (
                      <div
                        key={`doc-invoice-pending-${order.orderName}`}
                        className="doc-badge doc-invoice"
                        data-tooltip="Generate Invoice"
                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                      >
                        <FileText size={14} />
                      </div>
                    ) : (
                      <div
                        key={`doc-invoice-disabled-${order.orderName}`}
                        className="doc-badge doc-invoice"
                        data-tooltip="Generate Invoice"
                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                      >
                        <FileText size={14} />
                      </div>
                    )}

                    {/* Voucher Badge */}
                    {order.voucherNumber ? (
                      <a
                        key={`doc-voucher-${order.orderName}`}
                        href={`/api/voucher/${order.voucherNumber}/pdf`}
                        download={`label-${order.voucherNumber}.pdf`}
                        className="doc-badge doc-shipping voucher-with-copy"
                        onClick={(e) => {
                          // Let the browser handle the download
                          e.stopPropagation();
                        }}
                        onMouseEnter={(e) => handleVoucherMouseEnter(order.voucherNumber!, e)}
                        onMouseLeave={handleVoucherMouseLeave}
                      >
                        <Truck size={14} />
                      </a>
                    ) : status === 'Unfulfilled' ? (
                      <div
                        key={`doc-voucher-create-${order.orderName}`}
                        className="doc-badge doc-shipping"
                        data-tooltip="Create AWB"
                        style={{ 
                          cursor: isLoading ? 'wait' : 'pointer',
                          opacity: isLoading ? 0.5 : 1
                        }}
                        onClick={() => !isLoading && handleAction(
                          () => createVoucher(order.orderName, currentWorkspace!.workspace_id),
                          order.orderName,
                          'AWB created successfully!'
                        )}
                      >
                        <Truck size={14} />
                      </div>
                    ) : (
                      <div
                        key={`doc-voucher-disabled-${order.orderName}`}
                        className="doc-badge doc-shipping"
                        data-tooltip="Generate AWB"
                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                      >
                        <Truck size={14} />
                      </div>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div 
                      className="icon-btn" 
                      style={{ width: '28px', height: '28px', cursor: 'pointer' }} 
                      title="View Order"
                      onClick={() => handleViewOrder(order)}
                    >
                      <Eye size={14} />
                    </div>
                    <div className="icon-btn" style={{ width: '28px', height: '28px' }} title="Edit Order">
                      <Edit2 size={14} />
                    </div>
                    <div className="icon-btn" style={{ width: '28px', height: '28px', color: 'var(--accent)' }} title="Delete Order">
                      <Trash2 size={14} />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Order Details Modal */}
    <OrderDetailsModal
      order={selectedOrder}
      isOpen={isModalOpen}
      onClose={handleCloseModal}
    />

    {/* Voucher Copy Tooltip */}
    {hoveredVoucher && mounted && createPortal(
      <div
        className={`voucher-tooltip ${showTooltip ? 'show' : ''} ${copiedVoucher === hoveredVoucher ? 'copied' : ''}`}
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
        }}
        onMouseEnter={() => setHoveredVoucher(hoveredVoucher)}
        onMouseLeave={(e) => {
          // Add delay to allow moving back to badge
          setTimeout(() => {
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (!relatedTarget || !relatedTarget.closest('.voucher-with-copy')) {
              setHoveredVoucher(null);
              setCopiedVoucher(null);
            }
          }, 100);
        }}
        onClick={(e) => handleCopyVoucher(hoveredVoucher, e)}
      >
        <div className="tooltip-content-wrapper">
          {copiedVoucher === hoveredVoucher ? (
            <>
              <Check size={14} className="tooltip-icon success" />
              <span className="tooltip-text">Copied to clipboard!</span>
            </>
          ) : (
            <>
              <span className="tooltip-text">AWB: {hoveredVoucher}</span>
              <Copy size={14} className="tooltip-icon" />
            </>
          )}
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

