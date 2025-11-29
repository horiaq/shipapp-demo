'use client';

import useSWR from 'swr';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { fetchWithAuth } from '../utils/api';

interface DashboardStatsResponse {
  success: boolean;
  stats: {
    totalRevenue: string;
    totalOrders: number;
    processedOrders: number;
    ordersByStatus: Array<{
      status: string;
      count: string;
    }>;
  };
}

const fetcher = (url: string) => fetchWithAuth(url).then((r) => r.json());

export function useDashboardStats() {
  const { currentWorkspace } = useWorkspace();

  const buildUrl = () => {
    if (!currentWorkspace) return null;
    return `/api/workspaces/${currentWorkspace.workspace_id}/dashboard-stats?workspaceId=${currentWorkspace.workspace_id}`;
  };

  const { data, error, mutate } = useSWR<DashboardStatsResponse>(
    buildUrl(),
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    stats: data?.stats || null,
    loading: !error && !data,
    error,
    mutate,
  };
}


