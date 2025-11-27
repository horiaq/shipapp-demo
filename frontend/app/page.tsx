'use client';

import React from 'react';
import { Plus } from 'react-feather';
import { StatCard, RevenueChart, OrderStatusChart, RecentOrdersTable } from '@/components/Dashboard';

export default function DashboardPage() {
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
          value="€48,250"
          label="Total Revenue"
          trend={{ direction: 'up', value: '+12.5%' }}
          color="primary"
        />
        <StatCard
          icon="ShoppingBag"
          value="1,240"
          label="Total Orders"
          trend={{ direction: 'up', value: '+8.2%' }}
          color="secondary"
        />
        <StatCard
          icon="Activity"
          value="85%"
          label="Conversion Rate"
          trend={{ direction: 'down', value: '-2.4%' }}
          color="accent"
        />
        <StatCard
          icon="Users"
          value="3,820"
          label="Active Users"
          trend={{ direction: 'up', value: '+5.1%' }}
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
