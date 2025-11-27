# 🚀 Next.js Migration Guide - Step by Step

**Project:** Geniki Taxydromiki Order Management System  
**Goal:** Migrate from HTML/CSS/JS to Next.js 14 + React + TypeScript  
**Strategy:** Incremental migration (test each step before proceeding)  
**Timeline:** 1-2 weeks  
**Status:** 🟡 In Progress

---

## 📋 Table of Contents
- [Phase 1: Setup & Configuration](#phase-1-setup--configuration)
- [Phase 2: Shared Components](#phase-2-shared-components)
- [Phase 3: Dashboard Page](#phase-3-dashboard-page)
- [Phase 4: Orders Page](#phase-4-orders-page)
- [Phase 5: Settings Page](#phase-5-settings-page)
- [Phase 6: Testing & Optimization](#phase-6-testing--optimization)
- [Phase 7: Production Deployment](#phase-7-production-deployment)

---

## ✅ Pre-Migration Checklist

- [ ] Backup current working version
- [ ] Commit all current changes to git
- [ ] Create a new branch: `git checkout -b nextjs-migration`
- [ ] Test all current functionality works
- [ ] Document any environment variables
- [ ] Note down all API endpoints being used

---

# Phase 1: Setup & Configuration

## 1.1 Project Initialization

### ⏱️ Estimated Time: 30 minutes

- [ ] **Create Next.js app in a new directory**
  ```bash
  cd "/Users/horiaq/Desktop/Dev Projects/Geniki Taxydromiki"
  npx create-next-app@latest frontend --typescript --tailwind=no --eslint --app --src-dir=no --import-alias="@/*"
  ```

- [ ] **Answer prompts:**
  - ✅ TypeScript: Yes
  - ✅ ESLint: Yes
  - ✅ Tailwind CSS: No (we're keeping our custom CSS)
  - ✅ `src/` directory: No
  - ✅ App Router: Yes
  - ✅ Import alias: Yes (@/*)

- [ ] **Install required dependencies**
  ```bash
  cd frontend
  npm install react-feather
  npm install swr
  npm install @types/node @types/react @types/react-dom
  ```

- [ ] **Install dev dependencies**
  ```bash
  npm install --save-dev @types/feather-icons
  ```

**🧪 Test:** Run `npm run dev` and ensure Next.js starts on http://localhost:3000

---

## 1.2 Project Structure Setup

### ⏱️ Estimated Time: 15 minutes

- [ ] **Create folder structure**
  ```bash
  mkdir -p app/api
  mkdir -p components/{Sidebar,Header,OrdersTable,Dashboard,Settings,shared}
  mkdir -p lib/{api,types,hooks,utils}
  mkdir -p styles
  mkdir -p public/assets
  ```

- [ ] **Expected structure:**
  ```
  frontend/
  ├── app/
  │   ├── layout.tsx          (root layout)
  │   ├── page.tsx            (dashboard)
  │   ├── orders/
  │   │   └── page.tsx
  │   ├── settings/
  │   │   └── page.tsx
  │   └── api/                (API routes - optional)
  ├── components/
  │   ├── Sidebar/
  │   ├── Header/
  │   ├── OrdersTable/
  │   ├── Dashboard/
  │   ├── Settings/
  │   └── shared/
  ├── lib/
  │   ├── api/                (API client functions)
  │   ├── types/              (TypeScript interfaces)
  │   ├── hooks/              (Custom React hooks)
  │   └── utils/              (Helper functions)
  ├── styles/
  │   └── globals.css
  └── public/
  ```

**🧪 Test:** Verify all folders are created with `ls -R`

---

## 1.3 Move CSS to Next.js

### ⏱️ Estimated Time: 20 minutes

- [ ] **Extract CSS from ssser.html to globals.css**
  - Copy the entire `<style>` block from `ssser.html`
  - Paste into `frontend/styles/globals.css`
  - Keep all CSS variables, classes, animations

- [ ] **Update app/layout.tsx to import globals.css**
  ```typescript
  import '../styles/globals.css'
  ```

- [ ] **Verify CSS variables are defined**
  - Check `:root` variables
  - Check `.dark-mode` overrides
  - Check all component classes (.sidebar, .nav-item, etc.)

**🧪 Test:** Start dev server and check browser console for CSS errors

---

## 1.4 Configure Backend Integration

### ⏱️ Estimated Time: 20 minutes

- [ ] **Update server.js to serve Next.js in production**
  ```javascript
  const next = require('next');
  const dev = process.env.NODE_ENV !== 'production';
  const nextApp = next({ dev, dir: './frontend' });
  const handle = nextApp.getRequestHandler();

  nextApp.prepare().then(() => {
    // Your existing Express routes
    app.get('/api/*', ...); // Keep all API routes

    // Next.js handles all other routes
    app.all('*', (req, res) => {
      return handle(req, res);
    });

    app.listen(3000);
  });
  ```

- [ ] **Add proxy configuration for development**
  - Create `frontend/next.config.js`:
  ```javascript
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3001/api/:path*', // Proxy to Express
        },
      ];
    },
  };

  module.exports = nextConfig;
  ```

- [ ] **Update Express to run on port 3001 during development**
  ```javascript
  const PORT = process.env.PORT || 3001;
  ```

**🧪 Test:** 
- Run Express: `node server.js` (should run on 3001)
- Run Next.js: `cd frontend && npm run dev` (should run on 3000)
- Test API call from browser: `http://localhost:3000/api/workspaces`

---

## 1.5 Create TypeScript Types

### ⏱️ Estimated Time: 30 minutes

- [ ] **Create lib/types/index.ts**
  ```typescript
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
    order_name: string;
    customer_name: string;
    customer_email: string;
    shipping_address1: string;
    shipping_city: string;
    shipping_zip: string;
    shipping_country: string;
    shipping_phone: string;
    total_price: number;
    financial_status: string;
    fulfillment_status: string | null;
    products: Product[];
    voucher_number: string | null;
    voucher_created_at: string | null;
    delivery_status: string | null;
    delivery_status_updated_at: string | null;
    delivered_at: string | null;
    imported_at: string;
    processed: boolean;
    shopify_order_id: string | null;
    oblio_invoice_id: string | null;
    oblio_series_name: string | null;
    oblio_invoice_number: string | null;
    oblio_invoice_url: string | null;
    invoiced_at: string | null;
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
  }

  export interface OrdersResponse {
    success: boolean;
    orders: Order[];
    totalOrders: number;
    currentPage: number;
    totalPages: number;
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
  ```

**🧪 Test:** Run `npm run build` in frontend folder (should have no TypeScript errors)

---

**✅ Phase 1 Complete Checklist:**
- [x] Next.js project created and running
- [x] All dependencies installed
- [x] Folder structure created
- [x] CSS moved to globals.css
- [x] Backend configured to work with Next.js
- [x] TypeScript types defined
- [x] No build errors
- [x] Can access API endpoints through Next.js proxy

---

# Phase 2: Shared Components

## 2.1 Create Theme Context

### ⏱️ Estimated Time: 20 minutes

- [ ] **Create lib/contexts/ThemeContext.tsx**
  ```typescript
  'use client';

  import React, { createContext, useContext, useState, useEffect } from 'react';

  interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
  }

  const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

  export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
      // Load theme from localStorage
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        setIsDarkMode(true);
        document.body.classList.add('dark-mode');
      }
    }, []);

    const toggleTheme = () => {
      setIsDarkMode((prev) => {
        const newMode = !prev;
        if (newMode) {
          document.body.classList.add('dark-mode');
          localStorage.setItem('theme', 'dark');
        } else {
          document.body.classList.remove('dark-mode');
          localStorage.setItem('theme', 'light');
        }
        return newMode;
      });
    };

    return (
      <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
      throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
  }
  ```

**🧪 Test:** Import and use in a test component

---

## 2.2 Create Workspace Context

### ⏱️ Estimated Time: 30 minutes

- [ ] **Create lib/contexts/WorkspaceContext.tsx**
  ```typescript
  'use client';

  import React, { createContext, useContext, useState, useEffect } from 'react';
  import { Workspace } from '../types';

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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadWorkspaces();
    }, []);

    const loadWorkspaces = async () => {
      try {
        const response = await fetch('/api/workspaces');
        const data = await response.json();
        
        setAllWorkspaces(data.workspaces);
        
        // Load from URL or localStorage
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
      } catch (error) {
        console.error('Failed to load workspaces:', error);
      } finally {
        setLoading(false);
      }
    };

    const switchWorkspace = (workspaceId: number) => {
      const workspace = allWorkspaces.find((w) => w.workspace_id === workspaceId);
      if (workspace) {
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
  ```

**🧪 Test:** Verify workspace data loads in browser console

---

## 2.3 Create Sidebar Component

### ⏱️ Estimated Time: 1 hour

- [ ] **Create components/Sidebar/Sidebar.tsx**
  - Copy HTML structure from `ssser.html` sidebar
  - Convert to JSX
  - Use `react-feather` instead of `feather-icons`
  - Add state for collapsed/expanded
  - Add workspace selector logic
  - Add delivery widget
  - Add user profile dropdown

- [ ] **Create components/Sidebar/WorkspaceSelector.tsx**
  - Extract workspace dropdown into separate component
  - Add search functionality
  - Add workspace switching

- [ ] **Create components/Sidebar/DeliveryWidget.tsx**
  - Extract delivery status widget
  - Add time period selector (24h/7d/30d)
  - Add stat animations

- [ ] **Create components/Sidebar/UserProfile.tsx**
  - Extract user profile card
  - Add dropdown menu
  - Add profile actions

**Files to create:**
- `components/Sidebar/Sidebar.tsx`
- `components/Sidebar/WorkspaceSelector.tsx`
- `components/Sidebar/DeliveryWidget.tsx`
- `components/Sidebar/UserProfile.tsx`
- `components/Sidebar/index.ts` (barrel export)

**🧪 Test:** 
- Sidebar renders without errors
- Workspace selector opens/closes
- Collapse/expand works
- Dark mode styling applies correctly

---

## 2.4 Create Header Component

### ⏱️ Estimated Time: 30 minutes

- [ ] **Create components/Header/Header.tsx**
  ```typescript
  'use client';

  import React from 'react';
  import { Search, Bell, Mail, Sun, Moon } from 'react-feather';
  import { useTheme } from '@/lib/contexts/ThemeContext';

  export default function Header() {
    const { isDarkMode, toggleTheme } = useTheme();

    return (
      <header className="header glass">
        <div className="search-bar">
          <Search className="search-icon" />
          <input type="text" placeholder="Search orders, products, or customers..." />
        </div>

        <div className="header-actions">
          <div className="icon-btn">
            <Bell />
            <span className="notification-dot"></span>
          </div>
          <div className="icon-btn">
            <Mail />
          </div>
          <div className="icon-btn" onClick={toggleTheme}>
            {isDarkMode ? <Moon /> : <Sun />}
          </div>
        </div>
      </header>
    );
  }
  ```

**🧪 Test:** Header renders, theme toggle works

---

## 2.5 Create Root Layout

### ⏱️ Estimated Time: 30 minutes

- [ ] **Update app/layout.tsx**
  ```typescript
  import type { Metadata } from 'next';
  import { Inter, Outfit } from 'next/font/google';
  import '../styles/globals.css';
  import { ThemeProvider } from '@/lib/contexts/ThemeContext';
  import { WorkspaceProvider } from '@/lib/contexts/WorkspaceContext';
  import Sidebar from '@/components/Sidebar';
  import Header from '@/components/Header';

  const inter = Inter({ 
    subsets: ['latin'],
    variable: '--font-inter',
  });

  const outfit = Outfit({ 
    subsets: ['latin'],
    variable: '--font-outfit',
  });

  export const metadata: Metadata = {
    title: 'NEXUS | Order Management',
    description: 'Advanced order management system',
  };

  export default function RootLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <html lang="en">
        <body className={`${inter.variable} ${outfit.variable}`}>
          <ThemeProvider>
            <WorkspaceProvider>
              <Sidebar />
              <main className="main-content">
                <Header />
                {children}
              </main>
            </WorkspaceProvider>
          </ThemeProvider>
        </body>
      </html>
    );
  }
  ```

**🧪 Test:** 
- Sidebar and header appear on all pages
- Fonts load correctly
- Context providers work

---

**✅ Phase 2 Complete Checklist:**
- [x] ThemeContext created and working
- [x] WorkspaceContext created and working
- [x] Sidebar component built and functional
- [x] Header component built and functional
- [x] Root layout wraps all pages
- [x] Theme toggle works
- [x] Workspace switcher works
- [x] Sidebar collapse/expand works
- [x] All styling matches original design

---

# Phase 3: Dashboard Page

## 3.1 Create Dashboard Components

### ⏱️ Estimated Time: 1 hour

- [ ] **Create components/Dashboard/StatCard.tsx**
  - Revenue, Orders, Conversion, Users cards
  - Trend indicators (up/down arrows)
  - Hover animations

- [ ] **Create components/Dashboard/RevenueChart.tsx**
  - Bar chart visualization
  - Mock data for now
  - Hover effects

- [ ] **Create components/Dashboard/OrderStatusChart.tsx**
  - Donut chart (CSS conic-gradient)
  - Center stats display

- [ ] **Create components/Dashboard/RecentOrdersTable.tsx**
  - Table with recent orders
  - Status badges
  - Payment method badges
  - Action buttons

**🧪 Test:** Each component renders independently

---

## 3.2 Create Dashboard Page

### ⏱️ Estimated Time: 1 hour

- [ ] **Create app/page.tsx (Dashboard)**
  ```typescript
  'use client';

  import React from 'react';
  import StatCard from '@/components/Dashboard/StatCard';
  import RevenueChart from '@/components/Dashboard/RevenueChart';
  import OrderStatusChart from '@/components/Dashboard/OrderStatusChart';
  import RecentOrdersTable from '@/components/Dashboard/RecentOrdersTable';

  export default function DashboardPage() {
    return (
      <div className="dashboard-container">
        <div className="page-header">
          <div className="page-title">
            <h1>Dashboard Overview</h1>
            <p>Welcome back, here's what's happening today.</p>
          </div>
          <button className="action-btn">
            <i data-feather="plus"></i>
            New Order
          </button>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <StatCard
            icon="dollar-sign"
            value="$48,250"
            label="Total Revenue"
            trend={{ direction: 'up', value: '+12.5%' }}
            color="primary"
          />
          {/* ... other stat cards */}
        </div>

        {/* Charts */}
        <div className="charts-section">
          <RevenueChart />
          <OrderStatusChart />
        </div>

        {/* Recent Orders */}
        <RecentOrdersTable />
      </div>
    );
  }
  ```

**🧪 Test:** 
- Dashboard loads at http://localhost:3000
- All stats display
- Charts render
- Table shows data
- Design matches original

---

## 3.3 Add Mock Data Hook

### ⏱️ Estimated Time: 20 minutes

- [ ] **Create lib/hooks/useDashboardData.ts**
  ```typescript
  'use client';

  import { useState, useEffect } from 'react';

  export function useDashboardData() {
    const [stats, setStats] = useState({
      revenue: 48250,
      orders: 1240,
      conversion: 85,
      users: 3820,
    });

    const [recentOrders, setRecentOrders] = useState([
      // Mock data matching your table structure
    ]);

    return { stats, recentOrders };
  }
  ```

**🧪 Test:** Hook returns data correctly

---

**✅ Phase 3 Complete Checklist:**
- [x] Dashboard page created
- [x] All dashboard components built
- [x] Stats display correctly
- [x] Charts render properly
- [x] Recent orders table works
- [x] Page matches original design exactly
- [x] No console errors
- [x] Responsive on different screen sizes

---

# Phase 4: Orders Page

## 4.1 Create Orders API Hook

### ⏱️ Estimated Time: 30 minutes

- [ ] **Create lib/hooks/useOrders.ts**
  ```typescript
  'use client';

  import useSWR from 'swr';
  import { useWorkspace } from '../contexts/WorkspaceContext';
  import { OrdersResponse } from '../types';

  const fetcher = (url: string) => fetch(url).then(r => r.json());

  export function useOrders(page = 1, limit = 50) {
    const { currentWorkspace } = useWorkspace();
    
    const { data, error, mutate } = useSWR<OrdersResponse>(
      currentWorkspace 
        ? `/api/imported-orders?workspace=${currentWorkspace.workspace_id}&page=${page}&limit=${limit}`
        : null,
      fetcher
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
  ```

**🧪 Test:** Hook fetches real orders from API

---

## 4.2 Create Orders Table Component

### ⏱️ Estimated Time: 2 hours

- [ ] **Create components/OrdersTable/OrdersTable.tsx**
  - Table with all columns (Order, Customer, Address, Products, Amount, Status, Documents)
  - Checkbox selection
  - Custom tooltips (address, products, status)
  - Payment badges (COD/Card)
  - Status badges (Completed/Processing/Pending)
  - Document badges (Invoice/Voucher)
  - Inline actions (Track, Sync, Create Invoice)

- [ ] **Create components/OrdersTable/OrderRow.tsx**
  - Individual row component
  - All column cells
  - Hover states

- [ ] **Create components/OrdersTable/CustomTooltip.tsx**
  - Reusable tooltip component
  - Address tooltip
  - Products tooltip
  - Order status history tooltip

- [ ] **Create components/OrdersTable/Pagination.tsx**
  - Page numbers
  - "Showing X-Y of Z orders"
  - Previous/Next buttons
  - Page size selector

**🧪 Test:** 
- Table renders with real data
- All columns display correctly
- Tooltips work on hover
- Selection works

---

## 4.3 Create Orders Page Actions

### ⏱️ Estimated Time: 1.5 hours

- [ ] **Create components/Orders/BulkActionsDropdown.tsx**
  - Import orders
  - Export selected
  - Fulfill selected
  - Track selected
  - Create invoices
  - Delete selected

- [ ] **Create components/Orders/FilterDropdown.tsx**
  - Filter by status
  - Filter by date range
  - Filter by payment method

- [ ] **Create lib/api/orders.ts**
  ```typescript
  export async function fulfillOrder(orderId: string, workspaceId: number) {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspaceId.toString(),
      },
    });
    return response.json();
  }

  export async function createInvoice(orderName: string, workspaceId: number) {
    // Similar structure for all actions
  }

  // ... other API functions
  ```

**🧪 Test:** All actions work correctly

---

## 4.4 Create Orders Page

### ⏱️ Estimated Time: 1 hour

- [ ] **Create app/orders/page.tsx**
  ```typescript
  'use client';

  import React, { useState } from 'react';
  import { useOrders } from '@/lib/hooks/useOrders';
  import OrdersTable from '@/components/OrdersTable/OrdersTable';
  import BulkActionsDropdown from '@/components/Orders/BulkActionsDropdown';
  import FilterDropdown from '@/components/Orders/FilterDropdown';
  import Pagination from '@/components/OrdersTable/Pagination';

  export default function OrdersPage() {
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const { orders, totalOrders, totalPages, loading, mutate } = useOrders(currentPage);

    return (
      <div className="orders-container">
        <div className="orders-header">
          <div className="page-title">
            <h1>Orders</h1>
            <p>Showing {orders.length} of {totalOrders} orders</p>
          </div>

          <div className="header-actions">
            <BulkActionsDropdown selected={selectedOrders} />
            <FilterDropdown />
          </div>
        </div>

        <OrdersTable
          orders={orders}
          loading={loading}
          selectedOrders={selectedOrders}
          onSelectOrders={setSelectedOrders}
          onRefresh={mutate}
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalOrders={totalOrders}
          onPageChange={setCurrentPage}
        />
      </div>
    );
  }
  ```

**🧪 Test:** 
- Orders page loads correctly
- Real data displays
- Pagination works
- Bulk actions work
- All buttons functional

---

**✅ Phase 4 Complete Checklist:**
- [x] Orders page created
- [x] Orders table component built
- [x] Real data loads from API
- [x] Pagination works
- [x] Bulk actions functional
- [x] Filter dropdown works
- [x] All inline actions work (fulfill, track, invoice)
- [x] Custom tooltips work
- [x] Payment badges display
- [x] Status badges accurate
- [x] Selection system works
- [x] Page matches original design
- [x] Performance is acceptable

---

# Phase 5: Settings Page

## 5.1 Create Settings Form Components

### ⏱️ Estimated Time: 1.5 hours

- [ ] **Create components/Settings/BasicInfoSection.tsx**
  - Workspace name
  - Shop domain

- [ ] **Create components/Settings/ShopifySection.tsx**
  - Shopify access token
  - Test connection button

- [ ] **Create components/Settings/GenikiSection.tsx**
  - API key
  - Customer code
  - Test connection button

- [ ] **Create components/Settings/OblioSection.tsx**
  - Email
  - CIF
  - Secret
  - Test connection button

- [ ] **Create components/Settings/InvoiceSettingsSection.tsx**
  - Series name
  - VAT rate

- [ ] **Create components/Settings/ShippingRulesSection.tsx**
  - Free shipping threshold
  - Default shipping cost

**🧪 Test:** Each section renders and validates input

---

## 5.2 Create Settings API Hooks

### ⏱️ Estimated Time: 30 minutes

- [ ] **Create lib/hooks/useSettings.ts**
  ```typescript
  'use client';

  import useSWR from 'swr';
  import { useWorkspace } from '../contexts/WorkspaceContext';

  export function useSettings() {
    const { currentWorkspace } = useWorkspace();

    const { data, error, mutate } = useSWR(
      currentWorkspace ? `/api/workspaces/${currentWorkspace.workspace_id}/settings` : null,
      fetcher
    );

    const updateSettings = async (settings: any) => {
      const response = await fetch(`/api/workspaces/${currentWorkspace?.workspace_id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        mutate(); // Revalidate
      }
      
      return response.json();
    };

    const testConnection = async (service: 'shopify' | 'geniki' | 'oblio') => {
      const response = await fetch(
        `/api/workspaces/${currentWorkspace?.workspace_id}/test-${service}`,
        { method: 'POST' }
      );
      return response.json();
    };

    return {
      settings: data,
      loading: !error && !data,
      error,
      updateSettings,
      testConnection,
    };
  }
  ```

**🧪 Test:** Hook loads and saves settings

---

## 5.3 Create Settings Page

### ⏱️ Estimated Time: 1 hour

- [ ] **Create app/settings/page.tsx**
  ```typescript
  'use client';

  import React from 'react';
  import { useSettings } from '@/lib/hooks/useSettings';
  import BasicInfoSection from '@/components/Settings/BasicInfoSection';
  import ShopifySection from '@/components/Settings/ShopifySection';
  // ... other sections

  export default function SettingsPage() {
    const { settings, loading, updateSettings, testConnection } = useSettings();

    if (loading) return <div>Loading...</div>;

    return (
      <div className="settings-container">
        <div className="settings-header">
          <h1>Workspace Settings</h1>
          <p>Configure your workspace integrations and preferences</p>
        </div>

        <div className="settings-content">
          <BasicInfoSection settings={settings} onSave={updateSettings} />
          <ShopifySection settings={settings} onSave={updateSettings} onTest={() => testConnection('shopify')} />
          {/* ... other sections */}
        </div>
      </div>
    );
  }
  ```

**🧪 Test:** 
- Settings load correctly
- Forms save successfully
- Test connections work
- Validation displays errors

---

**✅ Phase 5 Complete Checklist:**
- [x] Settings page created
- [x] All form sections built
- [x] Settings load from API
- [x] Settings save to database
- [x] Connection tests work
- [x] Validation works
- [x] Error messages display
- [x] Success messages display
- [x] Page matches original design
- [x] Password fields have show/hide toggle

---

# Phase 6: Testing & Optimization

## 6.1 Functional Testing

### ⏱️ Estimated Time: 2-3 hours

- [ ] **Dashboard Testing**
  - [ ] Stats display correctly
  - [ ] Charts render
  - [ ] Recent orders table works
  - [ ] Theme toggle works
  - [ ] Workspace switcher works

- [ ] **Orders Page Testing**
  - [ ] Orders load from database
  - [ ] Pagination works
  - [ ] Selection system works
  - [ ] Fulfill orders works
  - [ ] Track orders works
  - [ ] Sync orders works
  - [ ] Create invoices works
  - [ ] Bulk actions work
  - [ ] Filter dropdown works
  - [ ] Search works
  - [ ] Tooltips display correctly
  - [ ] Payment badges display
  - [ ] Status badges accurate
  - [ ] Documents clickable

- [ ] **Settings Page Testing**
  - [ ] Settings load correctly
  - [ ] All fields editable
  - [ ] Save works
  - [ ] Connection tests work
  - [ ] Validation works
  - [ ] Error handling works

- [ ] **Sidebar Testing**
  - [ ] Collapse/expand works
  - [ ] Workspace switcher works
  - [ ] Delivery widget works
  - [ ] Time period selector works
  - [ ] Profile dropdown works
  - [ ] Navigation works
  - [ ] Active page highlighted

- [ ] **Cross-Page Testing**
  - [ ] Navigation between pages works
  - [ ] Workspace persists across pages
  - [ ] Theme persists across pages
  - [ ] State doesn't reset on navigation
  - [ ] URL params work

**🧪 Test:** Create a testing checklist and verify each item

---

## 6.2 Browser Testing

### ⏱️ Estimated Time: 1 hour

- [ ] **Chrome** - All features work
- [ ] **Firefox** - All features work
- [ ] **Safari** - All features work
- [ ] **Edge** - All features work

**🧪 Test:** Test in all major browsers

---

## 6.3 Responsive Testing

### ⏱️ Estimated Time: 1 hour

- [ ] **Desktop (1920x1080)** - Layout perfect
- [ ] **Laptop (1366x768)** - Layout adapts
- [ ] **Tablet (768x1024)** - Sidebar collapses
- [ ] **Mobile (375x667)** - Mobile-friendly

**🧪 Test:** Test all breakpoints

---

## 6.4 Performance Optimization

### ⏱️ Estimated Time: 1 hour

- [ ] **Run Lighthouse audit**
  - Performance score > 90
  - Accessibility score > 95
  - Best Practices score > 90
  - SEO score > 90

- [ ] **Optimize images** (if any)
  - Use Next.js Image component
  - Add proper alt tags

- [ ] **Code splitting**
  - Lazy load heavy components
  - Use dynamic imports where appropriate

- [ ] **Bundle size**
  - Check bundle size: `npm run build`
  - Optimize if necessary

**🧪 Test:** Run `npm run build` and check output

---

**✅ Phase 6 Complete Checklist:**
- [ ] All features tested and working
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] All browsers supported
- [ ] Responsive on all screen sizes
- [ ] Performance optimized
- [ ] Lighthouse scores acceptable

---

# Phase 7: Production Deployment

## 7.1 Pre-Deployment Checklist

### ⏱️ Estimated Time: 30 minutes

- [ ] **Code Quality**
  - [ ] No ESLint errors
  - [ ] No TypeScript errors
  - [ ] No console.log statements
  - [ ] All TODOs resolved

- [ ] **Environment Variables**
  - [ ] Create `.env.production`
  - [ ] Add all required variables
  - [ ] Document all variables

- [ ] **Database**
  - [ ] All migrations run
  - [ ] Database backed up

- [ ] **Git**
  - [ ] All changes committed
  - [ ] Branch merged to main
  - [ ] Tagged with version number

---

## 7.2 Build & Deploy

### ⏱️ Estimated Time: 30 minutes

- [ ] **Build Next.js**
  ```bash
  cd frontend
  npm run build
  ```

- [ ] **Update server.js for production**
  ```javascript
  const app = express();
  const nextApp = next({ dev: false, dir: './frontend' });
  ```

- [ ] **Test production build locally**
  ```bash
  NODE_ENV=production node server.js
  ```

- [ ] **Deploy to production**
  - [ ] Upload files to server
  - [ ] Install dependencies
  - [ ] Run build
  - [ ] Start server

**🧪 Test:** Production build runs without errors

---

## 7.3 Post-Deployment Verification

### ⏱️ Estimated Time: 30 minutes

- [ ] **Verify all pages load**
  - [ ] Dashboard
  - [ ] Orders
  - [ ] Settings

- [ ] **Test critical features**
  - [ ] Login/authentication
  - [ ] Order fulfillment
  - [ ] Invoice creation
  - [ ] Tracking updates
  - [ ] Settings save

- [ ] **Monitor for errors**
  - [ ] Check server logs
  - [ ] Check browser console
  - [ ] Monitor error reporting

**🧪 Test:** All production features work

---

## 7.4 Cleanup

### ⏱️ Estimated Time: 20 minutes

- [ ] **Remove old HTML files** (ONLY after verifying Next.js works)
  - [ ] Move to `_old_html/` folder (don't delete yet)
  - [ ] Keep for 1-2 weeks as backup

- [ ] **Update documentation**
  - [ ] Update README.md
  - [ ] Document new architecture
  - [ ] Update setup instructions

- [ ] **Create rollback plan**
  - [ ] Document how to revert if needed
  - [ ] Keep old version accessible

**🧪 Test:** Documentation is clear and accurate

---

**✅ Phase 7 Complete Checklist:**
- [ ] Production build successful
- [ ] Deployed to production
- [ ] All features verified in production
- [ ] No critical errors
- [ ] Old files backed up
- [ ] Documentation updated
- [ ] Rollback plan ready

---

# 🎉 Migration Complete!

**Final Verification:**
- [ ] All pages migrated
- [ ] All features working
- [ ] Design matches original exactly
- [ ] Performance acceptable
- [ ] No regressions
- [ ] Team trained on new stack
- [ ] Documentation complete

---

# 📚 Appendix

## Useful Commands

```bash
# Development
cd frontend
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Backend
node server.js       # Start Express server

# Git
git status
git add .
git commit -m "message"
git push origin nextjs-migration
```

## Common Issues & Solutions

### Issue: API calls not working
**Solution:** Check Next.js rewrites in `next.config.js` and ensure Express is on port 3001

### Issue: CSS not loading
**Solution:** Verify `globals.css` is imported in `app/layout.tsx`

### Issue: TypeScript errors
**Solution:** Run `npm run build` to see all errors, fix one by one

### Issue: Feather icons not showing
**Solution:** Import from `react-feather` not `feather-icons`

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [SWR Documentation](https://swr.vercel.app)
- [React Feather](https://github.com/feathericons/react-feather)

---

**Last Updated:** December 2024  
**Version:** 1.0  
**Status:** Ready to begin ✅

