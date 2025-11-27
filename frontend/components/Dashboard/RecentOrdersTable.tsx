'use client';

import React from 'react';
import { CreditCard, DollarSign, MoreVertical, Filter } from 'react-feather';

interface Order {
  id: string;
  customer: string;
  product: string;
  date: string;
  amount: string;
  paymentMethod: 'card' | 'cod';
  status: 'completed' | 'processing' | 'pending';
}

const mockOrders: Order[] = [
  {
    id: '#ORD-7235',
    customer: 'Sarah Connor',
    product: 'Neural Net Processor',
    date: 'Oct 24, 2025',
    amount: '$1,299.00',
    paymentMethod: 'card',
    status: 'completed',
  },
  {
    id: '#ORD-7234',
    customer: 'John Wick',
    product: 'Tactical Suit v2',
    date: 'Oct 24, 2025',
    amount: '$850.00',
    paymentMethod: 'cod',
    status: 'processing',
  },
  {
    id: '#ORD-7233',
    customer: 'Bruce Wayne',
    product: 'Grappling Hook',
    date: 'Oct 23, 2025',
    amount: '$450.00',
    paymentMethod: 'card',
    status: 'pending',
  },
  {
    id: '#ORD-7232',
    customer: 'Tony Stark',
    product: 'Arc Reactor Core',
    date: 'Oct 23, 2025',
    amount: '$5,000.00',
    paymentMethod: 'cod',
    status: 'completed',
  },
];

export default function RecentOrdersTable() {
  return (
    <div className="glass-card table-container">
      <div className="table-header">
        <h3 className="chart-title">Recent Orders</h3>
        <div className="header-actions">
          <div className="search-bar" style={{ width: 250 }}>
            <Filter className="search-icon" size={14} />
            <input
              type="text"
              placeholder="Filter orders..."
              style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', fontSize: '0.875rem' }}
            />
          </div>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {mockOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.customer}</td>
                <td>{order.product}</td>
                <td>{order.date}</td>
                <td>
                  <div className="amount-wrapper">
                    {order.amount}
                    <div
                      className={`payment-badge ${order.paymentMethod}`}
                      data-tooltip={order.paymentMethod === 'card' ? 'Paid by Card' : 'Cash on Delivery'}
                    >
                      {order.paymentMethod === 'card' ? (
                        <CreditCard size={11} />
                      ) : (
                        <DollarSign size={11} />
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-badge status-${order.status}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </td>
                <td>
                  <MoreVertical
                    size={16}
                    style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

