'use client';

import React from 'react';
import * as FeatherIcons from 'react-feather';

interface StatCardProps {
  icon: keyof typeof FeatherIcons;
  value: string;
  label: string;
  trend?: {
    direction: 'up' | 'down';
    value: string;
  };
  color: 'primary' | 'secondary' | 'accent' | 'success';
}

const colorMap = {
  primary: 'rgba(6, 182, 212, 0.1)',
  secondary: 'rgba(139, 92, 246, 0.1)',
  accent: 'rgba(244, 63, 94, 0.1)',
  success: 'rgba(16, 185, 129, 0.1)',
};

const iconColorMap = {
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  accent: 'var(--accent)',
  success: '#10b981',
};

export default function StatCard({ icon, value, label, trend, color }: StatCardProps) {
  const Icon = FeatherIcons[icon] as React.ComponentType<{ size?: number }>;
  const TrendIcon = trend?.direction === 'up' ? FeatherIcons.TrendingUp : FeatherIcons.TrendingDown;

  return (
    <div className="glass-card stat-card">
      <div className="stat-header">
        <div className="stat-icon" style={{ background: colorMap[color], color: iconColorMap[color] }}>
          <Icon size={20} />
        </div>
        {trend && (
          <div className={`stat-trend ${trend.direction === 'up' ? 'trend-up' : 'trend-down'}`}>
            <TrendIcon size={14} />
            <span>{trend.value}</span>
          </div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}


