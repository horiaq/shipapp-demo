'use client';

import React from 'react';
import { Search, Bell, Mail, Sun, Moon } from 'react-feather';
import { useTheme } from '@/lib/contexts/ThemeContext';

export default function Header() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="header glass">
      <div className="search-bar">
        <Search className="search-icon" size={18} />
        <input type="text" placeholder="Search orders, products, or customers..." />
      </div>

      <div className="header-actions">
        <div className="icon-btn">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </div>
        <div className="icon-btn">
          <Mail size={20} />
        </div>
        <div className="icon-btn" onClick={toggleTheme}>
          {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
        </div>
      </div>
    </header>
  );
}






