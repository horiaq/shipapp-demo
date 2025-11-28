'use client';

import React from 'react';
import { Plus } from 'react-feather';
import { StatCard, RevenueChart, OrderStatusChart, RecentOrdersTable } from '@/components/Dashboard';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';

export default function DashboardPage() {
  const { stats, loading } = useDashboardStats();

  // Calculate processing rate (percentage of orders that have been processed)
  const processingRate = stats && stats.totalOrders > 0 
    ? ((stats.processedOrders / stats.totalOrders) * 100).toFixed(1)
    : '0';

  // Format revenue for display
  const formattedRevenue = stats 
    ? `€${parseFloat(stats.totalRevenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '€0.00';

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Dashboard Overview</h1>
          <p>Welcome back, here's what's happening today.</p>
        </div>
        <button className="action-btn">
          <Plus size={20} />
          New Order
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          icon="DollarSign"
          value={loading ? 'Loading...' : formattedRevenue}
          label="Total Revenue"
          color="primary"
        />
        <StatCard
          icon="ShoppingBag"
          value={loading ? 'Loading...' : stats?.totalOrders.toLocaleString() || '0'}
          label="Total Orders"
          color="secondary"
        />
        <StatCard
          icon="Activity"
          value={loading ? 'Loading...' : `${processingRate}%`}
          label="Processing Rate"
          color="accent"
        />
        <StatCard
          icon="Package"
          value={loading ? 'Loading...' : stats?.processedOrders.toLocaleString() || '0'}
          label="Processed Orders"
          color="success"
        />
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <RevenueChart />
        <OrderStatusChart />
      </div>

      {/* Recent Orders */}
      <RecentOrdersTable />
    </div>
  );
}
