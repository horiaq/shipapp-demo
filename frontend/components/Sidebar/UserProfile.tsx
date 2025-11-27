'use client';

import React, { useState } from 'react';
import { User, Settings, HelpCircle, LogOut, ChevronRight } from 'react-feather';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function UserProfile() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  if (!user) return null;

  // Get user initials for avatar
  const initials = user.first_name && user.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user.email[0].toUpperCase();

  const displayName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.email.split('@')[0];

  return (
    <div className="user-profile" onClick={toggleDropdown} style={{ position: 'relative' }}>
      <div className={`profile-dropdown ${isOpen ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
        <a href="#" className="profile-menu-item">
          <User size={16} />
          <span>My Profile</span>
        </a>
        <a href="/settings" className="profile-menu-item">
          <Settings size={16} />
          <span>Settings</span>
        </a>
        <a href="#" className="profile-menu-item">
          <HelpCircle size={16} />
          <span>Help Center</span>
        </a>
        <div className="profile-menu-item logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </div>
      </div>
      
      <div className="avatar">{initials}</div>
      <div className="user-info">
        <h4>{displayName}</h4>
        <p>Admin</p>
      </div>
      <ChevronRight
        className="profile-chevron"
        style={{
          marginLeft: 'auto',
          color: 'var(--text-muted)',
          width: 16,
          transition: 'transform 0.3s ease',
          transform: isOpen ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}
      />
    </div>
  );
}

