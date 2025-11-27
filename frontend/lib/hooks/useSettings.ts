'use client';

import useSWR from 'swr';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { WorkspaceSettings, ApiResponse } from '../types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSettings() {
  const { currentWorkspace } = useWorkspace();

  const { data, error, mutate } = useSWR<{ success: boolean; settings: WorkspaceSettings }>(
    currentWorkspace ? `/api/workspaces/${currentWorkspace.workspace_id}/settings` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const updateSettings = async (settings: Partial<WorkspaceSettings>): Promise<ApiResponse<any>> => {
    if (!currentWorkspace) {
      return { success: false, message: 'No workspace selected' };
    }

    const response = await fetch(`/api/workspaces/${currentWorkspace.workspace_id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    const result = await response.json();
    
    if (result.success) {
      mutate(); // Revalidate settings
    }

    return result;
  };

  const testConnection = async (service: 'shopify' | 'geniki' | 'oblio'): Promise<ApiResponse<any>> => {
    if (!currentWorkspace) {
      return { success: false, message: 'No workspace selected' };
    }

    const response = await fetch(`/api/workspaces/${currentWorkspace.workspace_id}/test-${service}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    return response.json();
  };

  return {
    settings: data?.settings || null,
    loading: !error && !data,
    error,
    updateSettings,
    testConnection,
  };
}

