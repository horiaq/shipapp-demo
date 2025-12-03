'use client';

import React, { useEffect, useRef } from 'react';
import { MoreHorizontal } from 'react-feather';

export default function RevenueChart() {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current) {
      // Generate 12 random bars for the chart
      chartRef.current.innerHTML = '';
      for (let i = 0; i < 12; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        const height = Math.floor(Math.random() * 70) + 30;
        bar.style.height = `${height}%`;
        bar.title = `Month ${i + 1}: €${(height * 1000).toLocaleString()}`;
        chartRef.current.appendChild(bar);
      }
    }
  }, []);

  return (
    <div className="glass-card chart-container">
      <div className="chart-header">
        <h3 className="chart-title">Revenue Analytics</h3>
        <div className="icon-btn" style={{ width: 32, height: 32 }}>
          <MoreHorizontal size={16} />
        </div>
      </div>
      <div className="chart-area" ref={chartRef}>
        {/* Bars will be generated dynamically */}
      </div>
    </div>
  );
}






