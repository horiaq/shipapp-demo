'use client';

import React, { useState, useEffect } from 'react';
import { Users, User, Smile, Heart, Star, Zap, ShoppingBag } from 'react-feather';

export default function CustomersPage() {
  const [feedItems, setFeedItems] = useState<{ text: string; time: string }[]>([]);

  const activities = [
    { text: "New customer registered", time: "Just now" },
    { text: "Order #1234 placed", time: "2s ago" },
    { text: "Sarah viewed 'Wireless Headphones'", time: "5s ago" },
    { text: "Support ticket #998 resolved", time: "12s ago" },
    { text: "VIP status updated for Mike", time: "15s ago" }
  ];

  useEffect(() => {
    // Initial population
    const initial = [
      activities[0],
      activities[1],
      activities[2]
    ];
    setFeedItems(initial);

    // Random updates
    const interval = setInterval(() => {
      const item = activities[Math.floor(Math.random() * activities.length)];
      setFeedItems(prev => {
        const newItems = [item, ...prev];
        return newItems.slice(0, 4);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container customers-page">
      {/* Network Stage */}
      <div className="network-stage">
        
        {/* 3D Grid Floor */}
        <div className="grid-lines"></div>

        {/* Title Overlay */}
        <div className="title-overlay">
          <h1 className="title-text">Customer Intelligence</h1>
          <div className="subtitle-text">Mapping connections. Analyzing behavior. Predicting needs.</div>
        </div>

        {/* Central Hub */}
        <div className="central-hub">
          <div className="hub-core">
            <Users size={32} />
          </div>
          <div className="hub-ring" style={{ animationDelay: '0s' }}></div>
          <div className="hub-ring" style={{ animationDelay: '1s' }}></div>
          <div className="hub-ring" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Connecting Lines */}
        <div className="connection-line l1"></div>
        <div className="connection-line l2"></div>
        <div className="connection-line l3"></div>
        <div className="connection-line l4"></div>

        {/* Outer Orbit */}
        <div className="orbit-container">
          <div className="avatar-node a1" style={{ background: '#e0f2fe', borderColor: '#38bdf8' }}>
            <User size={20} color="#0284c7" />
          </div>
          <div className="avatar-node a2" style={{ background: '#f0fdf4', borderColor: '#4ade80' }}>
            <Smile size={20} color="#16a34a" />
          </div>
          <div className="avatar-node a3" style={{ background: '#fff1f2', borderColor: '#fb7185' }}>
            <Heart size={20} color="#e11d48" />
          </div>
          <div className="avatar-node a4" style={{ background: '#fff7ed', borderColor: '#fb923c' }}>
            <Star size={20} color="#ea580c" />
          </div>
        </div>

        {/* Inner Orbit (Reverse) */}
        <div className="orbit-container reverse">
          <div className="avatar-node a1" style={{ background: '#f5f3ff', borderColor: '#a78bfa' }}>
            <Zap size={20} color="#7c3aed" />
          </div>
          <div className="avatar-node a2" style={{ background: '#ecfdf5', borderColor: '#34d399' }}>
            <ShoppingBag size={20} color="#059669" />
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="activity-feed">
          <div className="feed-title">
            <div className="live-dot"></div>
            LIVE ACTIVITY
          </div>
          <div className="feed-list">
            {feedItems.map((item, index) => (
              <div key={index} className="feed-item">
                <div className="feed-avatar"></div>
                <div>
                  <div style={{ fontWeight: 500 }}>{item.text}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}


