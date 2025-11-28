import { ApiResponse } from '../types';
import { fetchWithAuth } from '../utils/api';

export async function fulfillOrder(orderId: string, workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth(`/api/orders/${encodeURIComponent(orderId)}/fulfill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
  });
  return response.json();
}

export async function trackOrder(voucherNumber: string, workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth(`/api/track/${voucherNumber}`, {
    method: 'GET',
    headers: {
      'X-Workspace-Id': workspaceId.toString(),
    },
  });
  return response.json();
}

export async function syncOrderStatus(voucherNumber: string, workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth(`/api/force-shopify-sync/${voucherNumber}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
  });
  return response.json();
}

export async function createInvoice(orderName: string, workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth(`/api/orders/${encodeURIComponent(orderName)}/create-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
  });
  return response.json();
}

export async function cancelInvoice(orderName: string, workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth(`/api/orders/${encodeURIComponent(orderName)}/cancel-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
  });
  return response.json();
}

export async function bulkFulfillOrders(orderIds: string[], workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth('/api/orders/bulk-fulfill', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
    body: JSON.stringify({ orderIds }),
  });
  return response.json();
}

export async function bulkCreateInvoices(orderNames: string[], workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth('/api/orders/bulk-create-invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
    body: JSON.stringify({ orderNames }),
  });
  return response.json();
}

export async function bulkUpdateTracking(workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth('/api/tracking/update-all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
    body: JSON.stringify({ workspaceId }),
  });
  return response.json();
}

export async function createVoucher(orderId: string, workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth(`/api/imported-orders/${encodeURIComponent(orderId)}/voucher`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
    body: JSON.stringify({ workspaceId }),
  });
  return response.json();
}

export async function exportLabels(orderIds: string[], workspaceId: number): Promise<Blob> {
  const response = await fetchWithAuth('/api/export-labels', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
    body: JSON.stringify({ orderIds, workspaceId }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to export labels');
  }
  
  return response.blob();
}

export async function sendLabelsToGeniki(orderIds: string[], workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth('/api/send-labels', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
    body: JSON.stringify({ orderIds, workspaceId }),
  });
  return response.json();
}

export async function syncFromShopify(orderIds: string[], workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth('/api/sync-from-shopify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
    body: JSON.stringify({ orderIds, workspaceId }),
  });
  return response.json();
}

export async function cancelOrder(orderId: string, workspaceId: number): Promise<ApiResponse<any>> {
  const response = await fetchWithAuth(`/api/imported-orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-Id': workspaceId.toString(),
    },
  });
  return response.json();
}

