/**
 * Fetch wrapper that automatically adds authentication headers
 * and handles 401/403 responses
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle authentication errors
  if (response.status === 401) {
    // Token expired or invalid
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentWorkspaceId');
      
      // Only redirect if not already on login/register page
      const currentPath = window.location.pathname;
      if (!['/login', '/register'].includes(currentPath)) {
        window.location.href = '/login';
      }
    }
    throw new Error('Authentication required');
  }

  // Handle authorization errors
  if (response.status === 403) {
    throw new Error('You do not have permission to access this resource');
  }

  return response;
}

/**
 * Convenience method for GET requests with auth
 */
export async function getWithAuth(url: string) {
  return fetchWithAuth(url, { method: 'GET' });
}

/**
 * Convenience method for POST requests with auth
 */
export async function postWithAuth(url: string, data?: any) {
  return fetchWithAuth(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined
  });
}

/**
 * Convenience method for PUT requests with auth
 */
export async function putWithAuth(url: string, data?: any) {
  return fetchWithAuth(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined
  });
}

/**
 * Convenience method for DELETE requests with auth
 */
export async function deleteWithAuth(url: string) {
  return fetchWithAuth(url, { method: 'DELETE' });
}

