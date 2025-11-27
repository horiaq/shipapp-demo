'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Workspace } from '../types';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  allWorkspaces: Workspace[];
  switchWorkspace: (workspaceId: number) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, workspaces: authWorkspaces } = useAuth();

  // Load workspaces when user is authenticated
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      const isPublicRoute = ['/login', '/register'].includes(window.location.pathname);
      
      if (!isPublicRoute) {
        // First check if we have workspaces from AuthContext
        if (authWorkspaces && authWorkspaces.length > 0) {
          console.log('Loading workspaces from AuthContext:', authWorkspaces);
          setAllWorkspaces(authWorkspaces as any);
          
          // Set current workspace
          const savedId = localStorage.getItem('currentWorkspaceId');
          let workspace;
          
          if (savedId) {
            workspace = authWorkspaces.find((w: any) => w.workspace_id === parseInt(savedId));
          }
          
          // If no saved workspace or saved one not found, use first workspace
          if (!workspace && authWorkspaces.length > 0) {
            workspace = authWorkspaces[0];
            // Save the default workspace ID
            localStorage.setItem('currentWorkspaceId', (authWorkspaces[0] as any).workspace_id.toString());
          }
          
          if (workspace) {
            console.log('Setting current workspace:', workspace);
            setCurrentWorkspace(workspace as any);
          }
        } else {
          // Fallback: load from API
          loadWorkspaces();
        }
      }
    }
  }, [isAuthenticated, authWorkspaces]);

  const loadWorkspaces = async () => {
    try {
      const { fetchWithAuth } = await import('@/lib/utils/api');
      const response = await fetchWithAuth('/api/workspaces');
      const data = await response.json();
      
      if (data.success && data.workspaces) {
        setAllWorkspaces(data.workspaces);
        
        // Load from URL or localStorage (only on client)
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const paramWorkspaceId = urlParams.get('workspace');
          
          if (paramWorkspaceId) {
            const workspace = data.workspaces.find(
              (w: Workspace) => w.workspace_id === parseInt(paramWorkspaceId)
            );
            if (workspace) {
              setCurrentWorkspace(workspace);
              localStorage.setItem('currentWorkspaceId', workspace.workspace_id.toString());
            }
          } else {
            const savedId = localStorage.getItem('currentWorkspaceId');
            const workspace = savedId 
              ? data.workspaces.find((w: Workspace) => w.workspace_id === parseInt(savedId))
              : data.workspaces[0];
            setCurrentWorkspace(workspace || data.workspaces[0]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchWorkspace = (workspaceId: number) => {
    const workspace = allWorkspaces.find((w) => w.workspace_id === workspaceId);
    if (workspace && typeof window !== 'undefined') {
      setCurrentWorkspace(workspace);
      localStorage.setItem('currentWorkspaceId', workspaceId.toString());
      
      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('workspace', workspaceId.toString());
      window.history.pushState({}, '', url);
    }
  };

  return (
    <WorkspaceContext.Provider value={{ 
      currentWorkspace, 
      allWorkspaces, 
      switchWorkspace,
      loading 
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}

