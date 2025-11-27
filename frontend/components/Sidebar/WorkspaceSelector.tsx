'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, Plus, Check } from 'react-feather';
import { useWorkspace } from '@/lib/contexts/WorkspaceContext';

export default function WorkspaceSelector() {
  const { currentWorkspace, allWorkspaces, switchWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelectWorkspace = (workspaceId: number) => {
    switchWorkspace(workspaceId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const filteredWorkspaces = allWorkspaces.filter((w) =>
    w.workspace_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  if (!currentWorkspace) return null;

  const workspaceIcon = currentWorkspace.workspace_name.charAt(0).toUpperCase();

  return (
    <div style={{ position: 'relative' }}>
      <div className="workspace-selector" onClick={toggleDropdown}>
        <div className="workspace-icon">{workspaceIcon}</div>
        <div className="workspace-info">
          <div className="workspace-name">{currentWorkspace.workspace_name}</div>
          <div className="workspace-role">
            <span>Admin</span>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)' }}></div>
            <span style={{ color: 'var(--primary)' }}>Pro</span>
          </div>
        </div>
        <ChevronDown
          className="selector-chevron"
          style={{
            width: 16,
            height: 16,
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
          }}
        />
      </div>

      <div className={`workspace-dropdown ${isOpen ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="workspace-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Find workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        
        <div className="workspace-list">
          {filteredWorkspaces.map((workspace) => {
            const icon = workspace.workspace_name.charAt(0).toUpperCase();
            const isActive = workspace.workspace_id === currentWorkspace.workspace_id;
            
            return (
              <div
                key={workspace.workspace_id}
                className={`workspace-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectWorkspace(workspace.workspace_id)}
              >
                <div className="item-icon">{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {workspace.workspace_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {workspace.shop_domain || 'No domain set'}
                  </div>
                </div>
                {isActive && <Check size={16} style={{ color: 'var(--primary)' }} />}
              </div>
            );
          })}
        </div>

        <div className="workspace-actions">
          <button className="create-workspace-btn">
            <Plus size={14} />
            <span>Create New Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
}

