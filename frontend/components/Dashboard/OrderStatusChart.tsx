'use client';

import React from 'react';

export default function OrderStatusChart() {
  const totalOrders = 1240;

  return (
    <div className="glass-card chart-container">
      <div className="chart-header">
        <h3 className="chart-title">Order Status</h3>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* CSS Donut Chart */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'conic-gradient(var(--primary) 0% 60%, var(--secondary) 60% 85%, var(--accent) 85% 100%)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="donut-center">
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {totalOrders.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }}></span>
          Completed
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary)' }}></span>
          Pending
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}></span>
          Cancelled
        </div>
      </div>
    </div>
  );
}

