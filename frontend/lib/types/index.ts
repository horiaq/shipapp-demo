// Workspace Types
export interface Workspace {
  workspace_id: number;
  workspace_name: string;
  workspace_slug: string;
  shop_domain: string | null;
  shopify_access_token: string | null;
  geniki_api_key: string | null;
  geniki_customer_code: string | null;
  oblio_email: string | null;
  oblio_cif: string | null;
  oblio_secret: string | null;
  oblio_series_name: string | null;
  oblio_vat_rate: string | null;
  is_active: boolean;
  created_at: string;
}

// Order Types
export interface Order {
  orderName: string;
  firstName: string;
  lastName: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
  country?: string;
  phone: string;
  totalPrice: number | string | null;
  financialStatus: string;
  fulfillmentStatus: string | null;
  products: Product[];
  voucherNumber: string | null;
  voucherCreated: string | null;
  deliveryStatus: string | null;
  deliveryStatusUpdatedAt: string | null;
  deliveredAt: string | null;
  importedAt: string;
  processed: boolean;
  shopifyOrderId: string | null;
  oblioInvoiceId: string | null;
  oblioSeriesName: string | null;
  oblioInvoiceNumber: string | null;
  oblioInvoiceUrl: string | null;
  invoicedAt: string | null;
  workspaceId?: number;
  orderStatus?: string; // Calculated order status: unfulfilled, awb_created, sent, in_transit, delivered, returned, completed
  sentToGeniki?: boolean; // Whether voucher was sent to Geniki (close pending)
  sentToGenikiAt?: string | null;
}

// Product Types
export interface Product {
  name: string;
  quantity: number;
  price: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface OrdersResponse {
  success: boolean;
  orders: Order[];
  totalOrders: number;
  currentPage: number;
  totalPages: number;
}

export interface WorkspacesResponse {
  success: boolean;
  workspaces: Workspace[];
}

// UI State Types
export interface ThemeState {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export interface SidebarState {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

// Settings Types
export interface WorkspaceSettings {
  workspace_name: string;
  shop_domain: string | null;
  shopify_access_token: string | null;
  geniki_api_key: string | null;
  geniki_customer_code: string | null;
  oblio_email: string | null;
  oblio_cif: string | null;
  oblio_secret: string | null;
  oblio_series_name: string | null;
  oblio_vat_rate: string | null;
}

// Dashboard Types
export interface DashboardStats {
  revenue: number;
  orders: number;
  conversion: number;
  users: number;
}

export interface DeliveryStats {
  inDelivery: number;
  delivered: number;
  returned: number;
}

// Action Types
export interface BulkAction {
  type: 'fulfill' | 'track' | 'invoice' | 'export' | 'delete';
  orderIds: string[];
}

