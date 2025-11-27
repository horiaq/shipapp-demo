'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'react-feather';
import { useWorkspace } from '@/lib/contexts/WorkspaceContext';
import { fetchWithAuth } from '@/lib/utils/api';

interface DeliveryStatsType {
  'in-delivery': number;
  delivered: number;
  returned: number;
}

export default function DeliveryWidget() {
  const { currentWorkspace } = useWorkspace();
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<DeliveryStatsType>({
    'in-delivery': 0,
    delivered: 0,
    returned: 0
  });
  const [displayStats, setDisplayStats] = useState<DeliveryStatsType>({
    'in-delivery': 0,
    delivered: 0,
    returned: 0
  });
  const [loading, setLoading] = useState(true);

  const inDeliveryRef = useRef<HTMLSpanElement>(null);
  const deliveredRef = useRef<HTMLSpanElement>(null);
  const returnedRef = useRef<HTMLSpanElement>(null);

  // Fetch delivery stats from API
  const fetchDeliveryStats = async (timeframe: string) => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const response = await fetchWithAuth(
        `/api/workspaces/${currentWorkspace.workspace_id}/delivery-stats?timeframe=${timeframe}`
      );
      const data = await response.json();

      if (data.success) {
        return data.stats;
      }
    } catch (error) {
      console.error('Error fetching delivery stats:', error);
    } finally {
      setLoading(false);
    }

    // Return empty stats on error
    return { 'in-delivery': 0, delivered: 0, returned: 0 };
  };

  // Refresh stats with animation
  const refreshStats = useCallback(async () => {
    if (!currentWorkspace) return;
    
    const oldStats = displayStats;
    const newStats = await fetchDeliveryStats(selectedPeriod);
    
    if (newStats) {
      // Animate the transition
      animateValue(inDeliveryRef.current, oldStats['in-delivery'], newStats['in-delivery'], 800);
      animateValue(deliveredRef.current, oldStats.delivered, newStats.delivered, 800);
      animateValue(returnedRef.current, oldStats.returned, newStats.returned, 800);
      
      setStats(newStats);
      setDisplayStats(newStats);
    }
  }, [currentWorkspace, selectedPeriod, displayStats]);

  // Load initial stats
  useEffect(() => {
    if (currentWorkspace) {
      fetchDeliveryStats(selectedPeriod).then((newStats) => {
        if (newStats) {
          setStats(newStats);
          setDisplayStats(newStats);
        }
      });
    }
  }, [currentWorkspace]);

  // Listen for tracking updates
  useEffect(() => {
    window.addEventListener('tracking-updated', refreshStats);
    return () => window.removeEventListener('tracking-updated', refreshStats);
  }, [refreshStats]);

  // Animate value counting
  const animateValue = (
    element: HTMLSpanElement | null,
    start: number,
    end: number,
    duration: number
  ) => {
    if (!element) return;

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const value = Math.floor(progress * (end - start) + start);
      element.textContent = value.toString();
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  };

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const selectPeriod = async (period: string) => {
    const oldStats = displayStats;

    // Fetch new stats
    const newStats = await fetchDeliveryStats(period);
    if (!newStats) return;

    // Animate the transition
    animateValue(inDeliveryRef.current, oldStats['in-delivery'], newStats['in-delivery'], 500);
    animateValue(deliveredRef.current, oldStats.delivered, newStats.delivered, 500);
    animateValue(returnedRef.current, oldStats.returned, newStats.returned, 500);

    setStats(newStats);
    setDisplayStats(newStats);
    setSelectedPeriod(period);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="delivery-widget glass-card">
      <div className="widget-header">
        <span className="widget-title">Delivery Status</span>
        <div className="time-selector" style={{ position: 'relative' }}>
          <div className="time-trigger" onClick={toggleDropdown}>
            <span>{selectedPeriod}</span>
            <ChevronDown
              size={12}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </div>
          <div className={`time-dropdown ${isOpen ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div
              className={`time-option ${selectedPeriod === '24h' ? 'active' : ''}`}
              onClick={() => selectPeriod('24h')}
            >
              Last 24 Hours
            </div>
            <div
              className={`time-option ${selectedPeriod === '7d' ? 'active' : ''}`}
              onClick={() => selectPeriod('7d')}
            >
              Last 7 Days
            </div>
            <div
              className={`time-option ${selectedPeriod === '30d' ? 'active' : ''}`}
              onClick={() => selectPeriod('30d')}
            >
              Last 30 Days
            </div>
          </div>
        </div>
      </div>
      <div className="widget-content">
        <div className="stat-row">
          <div className="stat-label">
            <div className="stat-dot dot-delivery"></div>
            <span>In Delivery</span>
          </div>
          <span className="stat-value-sm" ref={inDeliveryRef} data-stat="in-delivery">
            {stats['in-delivery']}
          </span>
        </div>
        <div className="stat-row">
          <div className="stat-label">
            <div className="stat-dot dot-delivered"></div>
            <span>Delivered</span>
          </div>
          <span className="stat-value-sm" ref={deliveredRef} data-stat="delivered">
            {stats.delivered}
          </span>
        </div>
        <div className="stat-row">
          <div className="stat-label">
            <div className="stat-dot dot-returned"></div>
            <span>Returned</span>
          </div>
          <span className="stat-value-sm" ref={returnedRef} data-stat="returned">
            {stats.returned}
          </span>
        </div>
      </div>
    </div>
  );
}

