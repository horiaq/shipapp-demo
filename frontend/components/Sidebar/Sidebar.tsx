'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid, ShoppingCart, Users, Package, BarChart2, Settings, ChevronLeft, ChevronRight } from 'react-feather';
import WorkspaceSelector from './WorkspaceSelector';
import DeliveryWidget from './DeliveryWidget';
import UserProfile from './UserProfile';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Load collapsed state from localStorage
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', newState.toString());
  };

  const navItems = [
    { href: '/', icon: Grid, label: 'Dashboard' },
    { href: '/orders', icon: ShoppingCart, label: 'Orders' },
    { href: '/customers', icon: Users, label: 'Customers' },
    { href: '/inventory', icon: Package, label: 'Inventory' },
    { href: '/analytics', icon: BarChart2, label: 'Analytics' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className={`sidebar glass ${isCollapsed ? 'collapsed' : ''}`} id="sidebar">
      <div className="sidebar-toggle" onClick={toggleCollapsed}>
        {isCollapsed ? (
          <ChevronRight style={{ width: 14, height: 14 }} />
        ) : (
          <ChevronLeft style={{ width: 14, height: 14 }} />
        )}
      </div>

      <div className="logo-container">
        <div className="app-brand">
          <div className="logo-icon">
            <Package style={{ width: 18, height: 18 }} />
          </div>
          <span className="logo-text">eTrack</span>
        </div>

        <WorkspaceSelector />
      </div>

      <nav className="nav-menu">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <DeliveryWidget />

      <UserProfile />
    </aside>
  );
}

