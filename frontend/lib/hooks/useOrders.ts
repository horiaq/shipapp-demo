'use client';

import useSWR from 'swr';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { OrdersResponse } from '../types';
import { fetchWithAuth } from '../utils/api';

const fetcher = (url: string) => fetchWithAuth(url).then((r) => r.json());

export function useOrders(page = 1, limit = 50, statusFilter?: string) {
  const { currentWorkspace } = useWorkspace();

  // Build URL with optional status filter
  const buildUrl = () => {
    if (!currentWorkspace) return null;
    let url = `/api/imported-orders?workspaceId=${currentWorkspace.workspace_id}&page=${page}&limit=${limit}`;
    if (statusFilter && statusFilter !== 'All') {
      url += `&status=${encodeURIComponent(statusFilter)}`;
    }
    return url;
  };

  const { data, error, mutate } = useSWR<OrdersResponse>(
    buildUrl(),
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    orders: data?.orders || [],
    totalOrders: data?.totalOrders || 0,
    currentPage: data?.currentPage || 1,
    totalPages: data?.totalPages || 1,
    loading: !error && !data,
    error,
    mutate, // For refetching after actions
  };
}

