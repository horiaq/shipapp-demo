'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, Plus, Check } from 'react-feather';
import { useWorkspace } from '@/lib/contexts/WorkspaceContext';
import { fetchWithAuth } from '@/lib/utils/api';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function WorkspaceSelector() {
  const { currentWorkspace, allWorkspaces, switchWorkspace } = useWorkspace();
  const { refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelectWorkspace = (workspaceId: number) => {
    switchWorkspace(workspaceId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateWorkspace = async () => {
    const workspaceName = prompt('Enter new workspace name:');
    
    if (!workspaceName || workspaceName.trim() === '') {
      return;
    }
    
    const storeName = prompt('Enter store name (optional):') || workspaceName.trim();
    const shopifyShop = prompt('Enter Shopify shop domain (optional, e.g., yourstore.myshopify.com):');
    
    setIsCreating(true);
    
    try {
      const response = await fetchWithAuth('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workspace_name: workspaceName.trim(),
          store_name: storeName.trim(),
          shopify_shop: shopifyShop?.trim() || null
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Workspace "${data.workspace.workspace_name}" created successfully!`);
        
        // Refresh user data to get updated workspace list
        await refreshUser();
        
        // Switch to the new workspace
        switchWorkspace(data.workspace.workspace_id);
        
        setIsOpen(false);
      } else {
        alert(`❌ Failed to create workspace: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      alert(`❌ Error creating workspace: ${error.message || 'Network error'}`);
    } finally {
      setIsCreating(false);
    }
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
          <button 
            className="create-workspace-btn"
            onClick={handleCreateWorkspace}
            disabled={isCreating}
          >
            <Plus size={14} />
            <span>{isCreating ? 'Creating...' : 'Create New Workspace'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

