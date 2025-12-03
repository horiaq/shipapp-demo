# Meest Courier Integration - Complete Implementation Guide

> **Purpose:** Complete technical documentation for implementing Meest courier integration
> **Version:** 1.0
> **Last Updated:** December 3, 2025
> **Source Project:** eTrack Shopify App

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Configuration](#2-api-configuration)
3. [Authentication](#3-authentication)
4. [TypeScript Type Definitions](#4-typescript-type-definitions)
5. [Database Schema](#5-database-schema)
6. [Backend Implementation](#6-backend-implementation)
7. [Courier Adapter Pattern](#7-courier-adapter-pattern)
8. [Frontend Settings UI](#8-frontend-settings-ui)
9. [API Endpoints](#9-api-endpoints)
10. [Error Handling & Retry Logic](#10-error-handling--retry-logic)
11. [Testing](#11-testing)
12. [Implementation Checklist](#12-implementation-checklist)
13. [Complete Source Files](#13-complete-source-files)

---

## 1. Overview

### What is Meest?

Meest World Logistic (MWL) is an international courier service primarily operating in Eastern Europe. In the eTrack implementation, Meest handles deliveries to:

| Country | Code | Notes |
|---------|------|-------|
| **Greece** | GR | Alternative to Geniki Taxydromiki |
| **Poland** | PL | Primary courier option |
| **Hungary** | HU | Primary courier option |
| **Bulgaria** | BG | Primary courier option |

### Features Supported

| Feature | Supported |
|---------|-----------|
| Home Delivery | ✅ Yes |
| Cash on Delivery (COD) | ✅ Yes |
| Tracking | ✅ Yes |
| Label PDF | ✅ Yes (Base64) |
| AWB Cancellation | ✅ Yes |
| Locker/Pickup Points | ✅ COLLECT_BOX service |

### Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Frontend   │────▶│  Express Server  │────▶│   Meest API   │
│ Settings UI │     │  (Meest Adapter) │     │ mwl.meest.com │
└─────────────┘     └──────────────────┘     └───────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │ (Shop Settings)  │
                    └──────────────────┘
```

---

## 2. API Configuration

### Base URLs

| Environment | URL |
|-------------|-----|
| **Production** | `https://mwl.meest.com/mwl` |
| **Staging** | `https://mwl-stage.meest.com/mwl` |
| **Swagger UI (Stage)** | `https://mwl-stage.meest.com/mwl/swagger-ui/index.html` |
| **Documentation** | `https://apidocs.meest.ro` |

### API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/api/auth` | POST | Authenticate, get bearer token |
| `/v2/api/auth/refresh-token` | POST | Refresh expired token |
| `/v2/api/parcels` | POST | Create parcel/shipment |
| `/v2/api/labels/standard` | GET | Get shipping label (Base64 PDF) |
| `/v2/api/tracking` | GET | Get tracking status |
| `/v2/api/available-services` | POST | Get available services for route |
| `/v2/api/parcels/cancel` | POST | Cancel a parcel |

### Available Services

| Service Code | Description | Use Case |
|--------------|-------------|----------|
| `ECONOMIC_STANDARD` | Standard delivery (5-7 days) | Default, cheapest option |
| `CARGO` | Heavy/large parcels | For larger/heavier items |
| `COLLECT_BOX` | Pickup point delivery | Customer collects from locker |

### Rate Limits

- Authentication: No explicit limit documented
- Parcel creation: Best practice is max 30 requests/minute
- Token validity: ~12 hours (43199 seconds)

---

## 3. Authentication

### How It Works

Meest uses **Bearer Token** authentication:

1. POST credentials to `/v2/api/auth`
2. Receive `access_token` (valid ~12 hours)
3. Use token in `Authorization: Bearer {token}` header for all requests

### Authentication Request

```http
POST /v2/api/auth
Host: mwl.meest.com
Content-Type: application/json

{
  "username": "YOUR_USERNAME",
  "password": "YOUR_PASSWORD"
}
```

### Authentication Response

```json
{
  "access_token": "861c31fe-e10e-4b43-a089-7d4de265ad23",
  "token_type": "bearer",
  "refresh_token": "e1038667-dde0-4926-a600-76f5824aa911",
  "expires_in": 43199
}
```

### Token Caching Strategy

```typescript
// Token cache (in-memory, per shop)
const tokenCache: Map<number, MeestTokenCache> = new Map();

// Token validity buffer (refresh 5 minutes before expiry)
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

interface MeestTokenCache {
  token: string;
  expiresAt: number;  // Unix timestamp
  shopId: number;
}

async function getMeestToken(credentials: MeestCredentials, shopId: number): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(shopId);
  if (cached && cached.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
    return cached.token;
  }

  // Authenticate
  const response = await axios.post(`${BASE_URL}/v2/api/auth`, {
    username: credentials.username,
    password: credentials.password,
  });

  const { access_token, expires_in } = response.data;

  // Cache the token
  const expiresAt = Date.now() + ((expires_in || 43200) * 1000);
  tokenCache.set(shopId, { token: access_token, expiresAt, shopId });

  return access_token;
}
```

**Key Implementation Details:**
- Cache tokens per shop (multi-tenant support)
- Refresh 5 minutes before expiry to avoid failures
- Clear cache when credentials change

---

## 4. TypeScript Type Definitions

Create a file `lib/couriers/meest-types.ts`:

```typescript
// ============================================================================
// Meest API Type Definitions
// ============================================================================
// API Base: https://mwl.meest.com/mwl (production)

// Service types available
export type MeestService = 'ECONOMIC_STANDARD' | 'CARGO' | 'COLLECT_BOX';

// Additional services
export type MeestAdditionalService = 'COD' | 'INSURANCE' | 'SMS_NOTIFICATION' | 'EMAIL_NOTIFICATION';

// ============================================================================
// Authentication
// ============================================================================

export interface MeestAuthRequest {
  username: string;
  password: string;
}

export interface MeestAuthResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
}

// ============================================================================
// Parcel Creation - Request Types
// ============================================================================

export interface MeestDimensions {
  width: number;   // cm, minimum 0.001
  height: number;  // cm, minimum 0.001
  length: number;  // cm, minimum 0.001
}

export interface MeestMetrics {
  dimensions: MeestDimensions;
  weight: number;  // kg, minimum 0.001
}

export interface MeestServiceDetails {
  service: MeestService;
  productType?: 'RM' | 'NRM' | 'SRM';
}

export interface MeestAddress {
  name: string;
  companyName?: string;
  country: string;      // ISO 3166-1 alpha-2 (e.g., PL, HU, BG, GR)
  zipCode: string;
  city: string;
  street: string;
  buildingNumber: string;
  flatNumber?: string;
  phone: string;        // e.164 format (e.g., +48123456789)
  email: string;
  addressNote?: string;
}

export interface MeestItemDescription {
  description: string;
  brand?: string;
  manufacturer?: string;
}

export interface MeestItemIdentifier {
  hsCode?: string;      // Customs code
  productEAN?: string;
  skuCode?: string;
}

export interface MeestItemLogistic {
  quantity: number;     // minimum 1
  weight: number;       // kg, minimum 0.001
}

export interface MeestItemValue {
  value: number;        // Declared value
  valueEUR?: number;
  valueUSD?: number;
}

export interface MeestItem {
  description: MeestItemDescription;
  identifier?: MeestItemIdentifier;
  logistic: MeestItemLogistic;
  value: MeestItemValue;
  originCountry?: string;
}

export interface MeestValue {
  localTotalValue: number;
  localCurrency: string;  // ISO 4217 (EUR, PLN, HUF, RON, BGN)
}

export interface MeestCOD {
  value: number;
  currency: string;     // ISO 4217
}

export interface MeestLogisticsOptions {
  labelFormat?: 'PDF' | 'ZPL' | 'PNG';
  bookCourier?: boolean;
  smsNotification?: boolean;
  emailNotification?: boolean;
}

export interface MeestCreateParcelRequest {
  parcelNumber: string;           // Unique identifier (we generate)
  serviceDetails: MeestServiceDetails;
  metrics: MeestMetrics;
  value: MeestValue;
  sender: MeestAddress;
  recipient: MeestAddress;
  items: MeestItem[];
  cod?: MeestCOD;
  logisticsOptions?: MeestLogisticsOptions;
}

// ============================================================================
// Parcel Creation - Response Types
// ============================================================================

export interface MeestCreateParcelResponse {
  objectID?: number;
  parcelNumber: string;
  firstMileTrackingNUmber?: string;  // Note: API has typo "NUmber"
  firstMileLabel?: string;           // Base64 encoded
  firstMileNote?: string;
  lastMileTrackingNumber?: string;
  lastMileLabel?: string;            // Base64 encoded
  lastMileNote?: string;
  eta?: string;
}

// ============================================================================
// Label Response
// ============================================================================

export interface MeestLabelResponse {
  label: string;        // Base64 encoded PDF
  format?: string;
}

// ============================================================================
// Tracking Types
// ============================================================================

export interface MeestTrackingEvent {
  date: string;
  status: string;
  statusCode: string;
  location?: string;
  description?: string;
}

export interface MeestTrackingResponse {
  parcelNumber: string;
  status: string;
  statusCode?: string;
  statusDate?: string;
  currentLocation?: string;
  estimatedDelivery?: string;
  events?: MeestTrackingEvent[];
}

// ============================================================================
// Error Response
// ============================================================================

export interface MeestErrorResponse {
  success: boolean;
  message: string;
  id?: number;
  parameter?: string;
}

export interface MeestValidationError {
  parameter: string;
  message: string;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface MeestCredentials {
  username: string;
  password: string;
}

export interface MeestTokenCache {
  token: string;
  expiresAt: number;  // Unix timestamp
  shopId: number;
}

// ============================================================================
// Shop Settings
// ============================================================================

export interface MeestShopSettings {
  meest_username: string;
  meest_password: string;
  meest_enabled: boolean;
  meest_default_service: MeestService;
  meest_default_weight: number;
  meest_default_width: number;
  meest_default_height: number;
  meest_default_length: number;
  meest_cod_handling: 'auto' | 'always' | 'never';
}

// ============================================================================
// Order Mapping (for transforming orders to Meest format)
// ============================================================================

export interface MeestOrderMapping {
  orderName: string;
  orderId: string;
  recipientName: string;
  recipientStreet: string;
  recipientBuildingNumber: string;
  recipientCity: string;
  recipientZipCode: string;
  recipientCountryCode: string;
  recipientPhone: string;
  recipientEmail: string;
  totalPrice: number;
  currency: string;
  isCOD: boolean;
  codAmount?: number;
  products: { name: string; quantity: number; price: number }[];
  weight?: number;
}
```

---

## 5. Database Schema

### Migration File: `migrations/004_meest_settings.sql`

```sql
-- ============================================================================
-- Migration: Add Meest credentials and shipping settings columns
-- ============================================================================
-- Run with: psql -U your_user -d your_database -f migrations/004_meest_settings.sql

-- Add Meest credentials to shops table
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS meest_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS meest_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS meest_enabled BOOLEAN DEFAULT FALSE;

-- Add Meest shipping settings to shops table
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS meest_default_service VARCHAR(50) DEFAULT 'ECONOMIC_STANDARD',
ADD COLUMN IF NOT EXISTS meest_default_weight DECIMAL(10,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS meest_default_width DECIMAL(10,2) DEFAULT 20.0,
ADD COLUMN IF NOT EXISTS meest_default_height DECIMAL(10,2) DEFAULT 15.0,
ADD COLUMN IF NOT EXISTS meest_default_length DECIMAL(10,2) DEFAULT 30.0,
ADD COLUMN IF NOT EXISTS meest_cod_handling VARCHAR(20) DEFAULT 'auto';

-- Add comments for documentation
COMMENT ON COLUMN shops.meest_username IS 'Meest API username';
COMMENT ON COLUMN shops.meest_password IS 'Meest API password';
COMMENT ON COLUMN shops.meest_enabled IS 'Whether Meest integration is enabled';
COMMENT ON COLUMN shops.meest_default_service IS 'Default Meest service: ECONOMIC_STANDARD, CARGO, COLLECT_BOX';
COMMENT ON COLUMN shops.meest_default_weight IS 'Default parcel weight in kg';
COMMENT ON COLUMN shops.meest_default_width IS 'Default parcel width in cm';
COMMENT ON COLUMN shops.meest_default_height IS 'Default parcel height in cm';
COMMENT ON COLUMN shops.meest_default_length IS 'Default parcel length in cm';
COMMENT ON COLUMN shops.meest_cod_handling IS 'COD handling: auto, always, never';

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'shops'
AND column_name LIKE 'meest_%'
ORDER BY column_name;
```

### Database Columns Summary

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `meest_username` | VARCHAR(255) | NULL | API username |
| `meest_password` | VARCHAR(255) | NULL | API password |
| `meest_enabled` | BOOLEAN | FALSE | Integration enabled |
| `meest_default_service` | VARCHAR(50) | 'ECONOMIC_STANDARD' | Default service type |
| `meest_default_weight` | DECIMAL(10,2) | 1.0 | Default weight (kg) |
| `meest_default_width` | DECIMAL(10,2) | 20.0 | Default width (cm) |
| `meest_default_height` | DECIMAL(10,2) | 15.0 | Default height (cm) |
| `meest_default_length` | DECIMAL(10,2) | 30.0 | Default length (cm) |
| `meest_cod_handling` | VARCHAR(20) | 'auto' | COD mode |

---

## 6. Backend Implementation

### Main Adapter File: `lib/couriers/meest.ts`

```typescript
// ============================================================================
// Meest API Client
// ============================================================================
// Handles all communication with Meest World Logistic API
// Documentation: https://apidocs.meest.ro

import axios, { AxiosError } from 'axios';
import { log } from '../logger';
import { withRetry } from '../api-retry';
import {
  MeestAuthRequest,
  MeestAuthResponse,
  MeestCreateParcelRequest,
  MeestCreateParcelResponse,
  MeestLabelResponse,
  MeestTrackingResponse,
  MeestCredentials,
  MeestTokenCache,
  MeestOrderMapping,
  MeestService,
  MeestAddress,
  MeestItem,
} from './meest-types';
import {
  CourierAdapter,
  CourierType,
  NormalizedOrder,
  ShopCourierSettings,
  LabelResult,
  TrackingResult,
  NormalizedTrackingStatus,
  TrackingCheckpoint,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const MEEST_API = {
  staging: 'https://mwl-stage.meest.com/mwl',
  production: 'https://mwl.meest.com/mwl',
};

// Use staging for development, production for live
const getBaseUrl = (): string => {
  return process.env.NODE_ENV === 'production'
    ? MEEST_API.production
    : MEEST_API.staging;
};

// Token cache (in-memory, per shop)
const tokenCache: Map<number, MeestTokenCache> = new Map();

// Token validity buffer (refresh 5 minutes before expiry)
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// Authentication
// ============================================================================

/**
 * Get a valid Meest API token for the shop
 * Caches tokens and refreshes when needed
 */
export async function getMeestToken(
  credentials: MeestCredentials,
  shopId: number
): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(shopId);
  if (cached && cached.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
    return cached.token;
  }

  // Need to authenticate
  log.info('Authenticating with Meest API', { shopId });

  try {
    const response = await axios.post<MeestAuthResponse>(
      `${getBaseUrl()}/v2/api/auth`,
      {
        username: credentials.username,
        password: credentials.password,
      } as MeestAuthRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      }
    );

    const { access_token, expires_in } = response.data;

    // Cache the token (default 12 hours if not specified)
    const expiresAt = Date.now() + ((expires_in || 43200) * 1000);
    tokenCache.set(shopId, {
      token: access_token,
      expiresAt,
      shopId,
    });

    log.info('Meest authentication successful', { shopId, expires_in });
    return access_token;

  } catch (error) {
    const axiosError = error as AxiosError;
    log.error('Meest authentication failed', {
      shopId,
      error: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
    });
    throw new Error(`Meest authentication failed: ${axiosError.message}`);
  }
}

/**
 * Clear cached token for a shop (e.g., when credentials change)
 */
export function clearMeestToken(shopId: number): void {
  tokenCache.delete(shopId);
  log.info('Cleared Meest token cache', { shopId });
}

// ============================================================================
// Parcel Creation
// ============================================================================

/**
 * Create a new parcel/shipment with Meest
 */
export async function createMeestParcel(
  credentials: MeestCredentials,
  shopId: number,
  parcelRequest: MeestCreateParcelRequest
): Promise<MeestCreateParcelResponse> {
  const result = await withRetry(async () => {
    const token = await getMeestToken(credentials, shopId);

    log.info('Creating Meest parcel', {
      shopId,
      parcelNumber: parcelRequest.parcelNumber,
      recipientCountry: parcelRequest.recipient.country,
      service: parcelRequest.serviceDetails.service,
    });

    const response = await axios.post<MeestCreateParcelResponse>(
      `${getBaseUrl()}/v2/api/parcels`,
      parcelRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 30000,
      }
    );

    log.info('Meest parcel created successfully', {
      shopId,
      parcelNumber: response.data.parcelNumber,
      objectID: response.data.objectID,
    });

    return response.data;
  }, { maxRetries: 3, initialDelayMs: 1000 });

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to create Meest parcel');
  }

  return result.data;
}

// ============================================================================
// Label Retrieval
// ============================================================================

/**
 * Get the shipping label for a parcel (Base64 PDF)
 */
export async function getMeestLabel(
  credentials: MeestCredentials,
  shopId: number,
  parcelNumber: string
): Promise<MeestLabelResponse> {
  const result = await withRetry(async () => {
    const token = await getMeestToken(credentials, shopId);

    log.info('Fetching Meest label', { shopId, parcelNumber });

    const response = await axios.get<MeestLabelResponse>(
      `${getBaseUrl()}/v2/api/labels/standard`,
      {
        params: { parcelNumber },
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 30000,
      }
    );

    log.info('Meest label fetched successfully', { shopId, parcelNumber });
    return response.data;
  }, { maxRetries: 3, initialDelayMs: 1000 });

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Meest label');
  }

  return result.data;
}

// ============================================================================
// Tracking
// ============================================================================

/**
 * Get tracking information for a parcel
 */
export async function getMeestTracking(
  credentials: MeestCredentials,
  shopId: number,
  parcelNumber: string
): Promise<MeestTrackingResponse> {
  const result = await withRetry(async () => {
    const token = await getMeestToken(credentials, shopId);

    log.info('Fetching Meest tracking', { shopId, parcelNumber });

    const response = await axios.get<MeestTrackingResponse>(
      `${getBaseUrl()}/v2/api/tracking`,
      {
        params: { parcelNumber },
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 15000,
      }
    );

    log.info('Meest tracking fetched', {
      shopId,
      parcelNumber,
      status: response.data.status,
    });

    return response.data;
  }, { maxRetries: 3, initialDelayMs: 1000 });

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Meest tracking');
  }

  return result.data;
}

// ============================================================================
// Parcel Cancellation
// ============================================================================

/**
 * Cancel a parcel that hasn't been shipped yet
 */
export async function cancelMeestParcel(
  credentials: MeestCredentials,
  shopId: number,
  parcelNumber: string
): Promise<boolean> {
  const result = await withRetry(async () => {
    const token = await getMeestToken(credentials, shopId);

    log.info('Cancelling Meest parcel', { shopId, parcelNumber });

    await axios.post(
      `${getBaseUrl()}/v2/api/parcels/cancel`,
      { parcelNumber },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 15000,
      }
    );

    log.info('Meest parcel cancelled', { shopId, parcelNumber });
    return true;
  }, { maxRetries: 2, initialDelayMs: 1000 });

  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to cancel Meest parcel');
  }

  return true;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique parcel number
 */
function generateParcelNumber(orderName: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const cleanOrderName = orderName.replace(/[^A-Z0-9]/gi, '').substring(0, 8).toUpperCase();
  return `ET${cleanOrderName}${timestamp}`.substring(0, 20);
}

/**
 * Build Meest parcel request from order data
 */
export function buildMeestParcelRequest(
  order: MeestOrderMapping,
  senderAddress: MeestAddress,
  settings: {
    service: MeestService;
    defaultWeight: number;
    defaultDimensions: { width: number; height: number; length: number };
    codHandling: 'auto' | 'always' | 'never';
  }
): MeestCreateParcelRequest {
  // Determine COD based on settings
  let isCOD = order.isCOD;
  if (settings.codHandling === 'always') {
    isCOD = true;
  } else if (settings.codHandling === 'never') {
    isCOD = false;
  }

  const weight = order.weight || settings.defaultWeight;

  // Build items array from order products
  const items: MeestItem[] = order.products.map((product, index) => ({
    description: {
      description: product.name,
    },
    logistic: {
      quantity: product.quantity,
      weight: weight / order.products.length,  // Distribute weight evenly
    },
    value: {
      value: product.price * product.quantity,
    },
  }));

  // If no products, create a generic item
  if (items.length === 0) {
    items.push({
      description: {
        description: `Order ${order.orderName}`,
      },
      logistic: {
        quantity: 1,
        weight: weight,
      },
      value: {
        value: order.totalPrice,
      },
    });
  }

  const request: MeestCreateParcelRequest = {
    parcelNumber: generateParcelNumber(order.orderName),
    serviceDetails: {
      service: settings.service,
    },
    metrics: {
      dimensions: {
        width: settings.defaultDimensions.width,
        height: settings.defaultDimensions.height,
        length: settings.defaultDimensions.length,
      },
      weight: weight,
    },
    value: {
      localTotalValue: order.totalPrice,
      localCurrency: order.currency || 'EUR',
    },
    sender: senderAddress,
    recipient: {
      name: order.recipientName,
      country: order.recipientCountryCode,
      zipCode: order.recipientZipCode,
      city: order.recipientCity,
      street: order.recipientStreet,
      buildingNumber: order.recipientBuildingNumber || '1',
      phone: order.recipientPhone,
      email: order.recipientEmail,
    },
    items: items,
    logisticsOptions: {
      labelFormat: 'PDF',
    },
  };

  // Add COD if applicable
  if (isCOD) {
    request.cod = {
      value: order.codAmount || order.totalPrice,
      currency: order.currency || 'EUR',
    };
  }

  return request;
}

/**
 * Map order from database to Meest format
 */
export function mapOrderToMeest(dbOrder: any): MeestOrderMapping {
  // Determine if COD based on payment method/status
  const isCOD =
    dbOrder.payment_method?.toLowerCase().includes('cod') ||
    dbOrder.payment_status?.toLowerCase() === 'cod' ||
    dbOrder.financial_status?.toLowerCase() === 'pending';

  // Build products array from line items
  let products: { name: string; quantity: number; price: number }[] = [];
  if (dbOrder.products && Array.isArray(dbOrder.products)) {
    products = dbOrder.products.map((p: any) => ({
      name: p.name || 'Product',
      quantity: p.quantity || 1,
      price: parseFloat(p.price) || 0,
    }));
  }

  // Extract building number from address if possible
  const address = dbOrder.shipping_address1 || '';
  const buildingMatch = address.match(/\d+/);
  const buildingNumber = buildingMatch ? buildingMatch[0] : '1';
  const street = address.replace(/^\d+\s*/, '').trim() || address;

  return {
    orderName: dbOrder.order_name,
    orderId: dbOrder.shopify_order_id || dbOrder.id?.toString(),
    recipientName: `${dbOrder.first_name || ''} ${dbOrder.last_name || ''}`.trim() || 'Customer',
    recipientStreet: street,
    recipientBuildingNumber: buildingNumber,
    recipientCity: dbOrder.shipping_city || '',
    recipientZipCode: dbOrder.shipping_zip || '',
    recipientCountryCode: dbOrder.shipping_country_code || 'PL',
    recipientPhone: dbOrder.shipping_phone || '',
    recipientEmail: dbOrder.email || 'noreply@example.com',
    totalPrice: parseFloat(dbOrder.total_price) || 0,
    currency: dbOrder.currency || 'EUR',
    isCOD,
    codAmount: isCOD ? parseFloat(dbOrder.total_price) : undefined,
    products,
  };
}

/**
 * Normalize Meest status to internal status
 */
export function normalizeMeestStatus(meestStatus: string): string {
  const statusMap: Record<string, string> = {
    'CREATED': 'awb_created',
    'PICKED_UP': 'in_transit',
    'IN_TRANSIT': 'in_transit',
    'OUT_FOR_DELIVERY': 'in_transit',
    'DELIVERED': 'delivered',
    'RETURNED': 'returned',
    'CANCELLED': 'cancelled',
    'REFUSED': 'returned',
    'EXCEPTION': 'in_transit',
  };

  return statusMap[meestStatus?.toUpperCase()] || 'in_transit';
}

/**
 * Test Meest API connection with credentials
 */
export async function testMeestConnection(
  credentials: MeestCredentials,
  shopId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await getMeestToken(credentials, shopId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// Export singleton adapter instance (see next section for full implementation)
export const meestAdapter = new MeestAdapter();
```

---

## 7. Courier Adapter Pattern

### Unified Courier Interface (`lib/couriers/types.ts`)

The adapter pattern allows multiple couriers to be used interchangeably:

```typescript
export type CourierType = 'geniki' | 'meest' | 'sameday' | 'cargus';

export interface CourierAdapter {
  readonly type: CourierType;
  readonly name: string;
  readonly displayName: string;

  isConfigured(settings: ShopCourierSettings): boolean;
  supportsCountry(countryCode: string): boolean;

  createLabel(order: NormalizedOrder, settings: ShopCourierSettings): Promise<LabelResult>;
  getLabelPdf(trackingNumber: string, settings: ShopCourierSettings): Promise<Buffer>;
  cancelLabel(trackingNumber: string, labelId: string | undefined, settings: ShopCourierSettings): Promise<boolean>;
  getTracking(trackingNumber: string, settings: ShopCourierSettings): Promise<TrackingResult>;
  testConnection(settings: ShopCourierSettings): Promise<boolean>;
}
```

### MeestAdapter Class Implementation

Add this to `lib/couriers/meest.ts`:

```typescript
export class MeestAdapter implements CourierAdapter {
  readonly type: CourierType = 'meest';
  readonly name = 'meest';
  readonly displayName = 'Meest';

  isConfigured(settings: ShopCourierSettings): boolean {
    return settings.meest?.enabled === true &&
           !!settings.meest?.username &&
           !!settings.meest?.password;
  }

  supportsCountry(countryCode: string): boolean {
    const supported = ['GR', 'PL', 'HU', 'BG'];
    return supported.includes(countryCode.toUpperCase());
  }

  async createLabel(
    order: NormalizedOrder,
    settings: ShopCourierSettings
  ): Promise<LabelResult> {
    if (!this.isConfigured(settings)) {
      return {
        success: false,
        courierType: 'meest',
        courierName: 'Meest',
        error: 'Meest is not configured for this shop',
        errorCode: 'NOT_CONFIGURED',
      };
    }

    try {
      const credentials: MeestCredentials = {
        username: settings.meest!.username!,
        password: settings.meest!.password!,
      };

      // Build sender address from shop settings
      const senderAddress: MeestAddress = {
        name: settings.shopDomain.split('.')[0],
        country: order.shippingAddress.countryCode,
        zipCode: '00000',  // Should come from shop settings
        city: 'Default City',
        street: 'Default Street',
        buildingNumber: '1',
        phone: '',
        email: '',
      };

      // Convert normalized order to Meest format
      const orderMapping = this.normalizedToMeestMapping(order);

      // Build request
      const parcelRequest = buildMeestParcelRequest(
        orderMapping,
        senderAddress,
        {
          service: (settings.meest?.defaultService as MeestService) || 'ECONOMIC_STANDARD',
          defaultWeight: settings.meest?.defaultWeight || 1,
          defaultDimensions: settings.meest?.defaultDimensions || { width: 20, height: 10, length: 30 },
          codHandling: (settings.meest?.codHandling as 'auto' | 'always' | 'never') || 'auto',
        }
      );

      // Create parcel
      const result = await createMeestParcel(credentials, settings.shopId, parcelRequest);

      return {
        success: true,
        trackingNumber: result.parcelNumber,
        labelId: result.objectID?.toString(),
        courierType: 'meest',
        courierName: 'Meest',
      };
    } catch (error: any) {
      log.error('Meest label creation failed', {
        shopId: settings.shopId,
        orderName: order.orderName,
        error: error.message,
      });

      return {
        success: false,
        courierType: 'meest',
        courierName: 'Meest',
        error: error.message,
        errorCode: 'MEEST_API_ERROR',
      };
    }
  }

  async getLabelPdf(
    trackingNumber: string,
    settings: ShopCourierSettings
  ): Promise<Buffer> {
    if (!this.isConfigured(settings)) {
      throw new Error('Meest is not configured for this shop');
    }

    const credentials: MeestCredentials = {
      username: settings.meest!.username!,
      password: settings.meest!.password!,
    };

    const labelResponse = await getMeestLabel(credentials, settings.shopId, trackingNumber);

    // Convert base64 to buffer
    if (labelResponse.label) {
      return Buffer.from(labelResponse.label, 'base64');
    }

    throw new Error('No label data returned from Meest');
  }

  async cancelLabel(
    trackingNumber: string,
    labelId: string | undefined,
    settings: ShopCourierSettings
  ): Promise<boolean> {
    if (!this.isConfigured(settings)) {
      throw new Error('Meest is not configured for this shop');
    }

    const credentials: MeestCredentials = {
      username: settings.meest!.username!,
      password: settings.meest!.password!,
    };

    return await cancelMeestParcel(credentials, settings.shopId, trackingNumber);
  }

  async getTracking(
    trackingNumber: string,
    settings: ShopCourierSettings
  ): Promise<TrackingResult> {
    if (!this.isConfigured(settings)) {
      return {
        success: false,
        trackingNumber,
        currentStatus: 'unknown',
        rawStatus: '',
        checkpoints: [],
        isDelivered: false,
        isReturned: false,
        error: 'Meest is not configured for this shop',
      };
    }

    try {
      const credentials: MeestCredentials = {
        username: settings.meest!.username!,
        password: settings.meest!.password!,
      };

      const tracking = await getMeestTracking(credentials, settings.shopId, trackingNumber);

      // Normalize status
      const normalizedStatus = this.normalizeTrackingStatus(tracking.status);

      // Build checkpoints from events
      const checkpoints: TrackingCheckpoint[] = (tracking.events || []).map((event: any) => ({
        timestamp: new Date(event.timestamp || event.date),
        status: this.normalizeTrackingStatus(event.status),
        rawStatus: event.status,
        location: event.location,
        description: event.description,
      }));

      return {
        success: true,
        trackingNumber,
        currentStatus: normalizedStatus,
        rawStatus: tracking.status,
        checkpoints,
        isDelivered: normalizedStatus === 'delivered',
        deliveredAt: normalizedStatus === 'delivered' && tracking.statusDate
          ? new Date(tracking.statusDate)
          : undefined,
        isReturned: normalizedStatus === 'returned',
      };
    } catch (error: any) {
      return {
        success: false,
        trackingNumber,
        currentStatus: 'unknown',
        rawStatus: '',
        checkpoints: [],
        isDelivered: false,
        isReturned: false,
        error: error.message,
      };
    }
  }

  async testConnection(settings: ShopCourierSettings): Promise<boolean> {
    if (!this.isConfigured(settings)) {
      return false;
    }

    const credentials: MeestCredentials = {
      username: settings.meest!.username!,
      password: settings.meest!.password!,
    };

    const result = await testMeestConnection(credentials, settings.shopId);
    return result.success;
  }

  // Private helper: Convert normalized order to Meest mapping format
  private normalizedToMeestMapping(order: NormalizedOrder): MeestOrderMapping {
    return {
      orderName: order.orderName,
      orderId: order.orderId,
      recipientName: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim(),
      recipientStreet: order.shippingAddress.address1,
      recipientBuildingNumber: '1',
      recipientCity: order.shippingAddress.city,
      recipientZipCode: order.shippingAddress.zip,
      recipientCountryCode: order.shippingAddress.countryCode,
      recipientPhone: order.shippingAddress.phone,
      recipientEmail: order.shippingAddress.email || 'noreply@example.com',
      totalPrice: order.totalPrice,
      currency: order.currency,
      isCOD: order.isCOD,
      codAmount: order.codAmount,
      products: order.lineItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.pricePerUnit || 0,
      })),
    };
  }

  // Private helper: Normalize Meest status
  private normalizeTrackingStatus(meestStatus: string): NormalizedTrackingStatus {
    const status = (meestStatus || '').toUpperCase();

    if (status.includes('DELIVERED') || status === 'DELIVERED') return 'delivered';
    if (status.includes('RETURN') || status === 'RETURNED' || status === 'REFUSED') return 'returned';
    if (status.includes('CANCEL') || status === 'CANCELLED') return 'cancelled';
    if (status.includes('OUT_FOR') || status.includes('OUT FOR')) return 'out_for_delivery';
    if (status.includes('TRANSIT') || status.includes('IN_TRANSIT')) return 'in_transit';
    if (status.includes('PICKED') || status.includes('PICKED_UP')) return 'picked_up';
    if (status.includes('CREATED') || status === 'CREATED') return 'pending';
    if (status.includes('FAIL') || status === 'FAILED') return 'failed';

    return 'unknown';
  }
}
```

### Register Adapter in Courier Router (`lib/couriers/index.ts`)

```typescript
import { meestAdapter } from './meest';

// Registry of all available courier adapters
const adapters: Map<CourierType, CourierAdapter> = new Map();

// Register adapters
adapters.set('meest', meestAdapter);
// ... other adapters

export { meestAdapter };
```

---

## 8. Frontend Settings UI

### Settings Configuration Object (React/Next.js)

```typescript
// Settings interface
interface Settings {
  meest_username: string;
  meest_password: string;
  meest_default_service: string;
  meest_default_weight: string;
  meest_default_width: string;
  meest_default_height: string;
  meest_default_length: string;
  meest_cod_handling: string;
}

// Integration card configuration
const integrations = {
  meest: {
    title: "Meest",
    subtitle: "International courier for Poland, Hungary, and Bulgaria deliveries.",
    icon: Package,  // Lucide React icon
    color: "linear-gradient(135deg, #22c55e, #16a34a)",
    steps: [
      { title: "Meest Account", desc: "Contact Meest to get your business credentials." },
      { title: "Configure", desc: "Enter credentials and set shipping defaults below." },
      { title: "Connect", desc: "Save settings to start creating Meest labels." }
    ],
    fields: [
      { label: "Username", type: "text", key: "meest_username" },
      { label: "Password", type: "password", key: "meest_password" },
      {
        label: "Default Service",
        type: "select",
        key: "meest_default_service",
        options: [
          { value: "ECONOMIC_STANDARD", label: "Economic Standard (5-7 days)" },
          { value: "CARGO", label: "Cargo (Heavier parcels)" }
        ]
      },
      { label: "Default Weight (kg)", type: "number", key: "meest_default_weight" },
      {
        label: "Package Size",
        type: "dimensions",
        keys: {
          width: "meest_default_width",
          height: "meest_default_height",
          length: "meest_default_length"
        }
      },
      {
        label: "COD Handling",
        type: "select",
        key: "meest_cod_handling",
        options: [
          { value: "auto", label: "Auto-detect from order payment" },
          { value: "always", label: "Always COD" },
          { value: "never", label: "Never COD (Prepaid only)" }
        ]
      }
    ]
  }
};
```

### Connection Status Check

```typescript
// Check if Meest is connected
const connectionStatuses = {
  meest: Boolean(ws.meest_username && ws.meest_password),
};
```

### Load Settings from Backend

```typescript
// In useEffect or data fetching
const response = await fetch(`/api/workspaces/${workspaceId}/settings`);
const data = await response.json();

setSettings({
  meest_username: data.meest_username || '',
  meest_password: data.meest_password || '',
  meest_default_service: data.meest_default_service || 'ECONOMIC_STANDARD',
  meest_default_weight: data.meest_default_weight || '1',
  meest_default_width: data.meest_default_width || '20',
  meest_default_height: data.meest_default_height || '15',
  meest_default_length: data.meest_default_length || '30',
  meest_cod_handling: data.meest_cod_handling || 'auto',
});
```

---

## 9. API Endpoints

### Backend Route Examples (Express)

```typescript
// Build shop courier settings from database
async function buildShopCourierSettings(shopId: number): Promise<ShopCourierSettings> {
  const result = await pool.query(`
    SELECT
      shop_id, shop_domain,
      meest_username, meest_password, meest_enabled,
      meest_default_service, meest_default_weight,
      meest_default_width, meest_default_height, meest_default_length,
      meest_cod_handling
    FROM shops
    WHERE shop_id = $1
  `, [shopId]);

  const shop = result.rows[0];

  return {
    shopId: shop.shop_id,
    shopDomain: shop.shop_domain,
    meest: {
      enabled: shop.meest_enabled === true,
      username: shop.meest_username,
      password: shop.meest_password,
      defaultService: shop.meest_default_service || 'ECONOMIC_STANDARD',
      defaultWeight: parseFloat(shop.meest_default_weight) || 1.0,
      defaultDimensions: {
        width: parseFloat(shop.meest_default_width) || 20,
        height: parseFloat(shop.meest_default_height) || 15,
        length: parseFloat(shop.meest_default_length) || 30,
      },
      codHandling: shop.meest_cod_handling || 'auto',
    },
  };
}

// Create label with specific courier
app.post('/api/orders/:id/voucher', async (req, res) => {
  const { courier } = req.body;

  if (courier === 'meest') {
    const shopSettings = await buildShopCourierSettings(req.shopId);
    const labelResult = await courierService.createLabel(normalizedOrder, shopSettings, {
      explicitCourier: 'meest',
    });

    // Store voucher in database and return result
  }
});

// Get label PDF
app.get('/api/voucher/:trackingNumber/pdf', async (req, res) => {
  const { trackingNumber } = req.params;
  const voucher = await getVoucherByTrackingNumber(trackingNumber);

  if (voucher.courier_type === 'meest') {
    const shopSettings = await buildShopCourierSettings(voucher.shop_id);
    const pdfBuffer = await courierService.getLabelPdf(trackingNumber, 'meest', shopSettings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${trackingNumber}.pdf"`);
    res.send(pdfBuffer);
  }
});

// Update settings
app.put('/api/workspaces/:id/settings', async (req, res) => {
  const { settings } = req.body;
  const updates = [];
  const values = [];
  let paramCount = 1;

  // Meest credentials
  if (settings.meest_username !== undefined) {
    updates.push(`meest_username = $${paramCount++}`);
    values.push(settings.meest_username);
  }
  if (settings.meest_password !== undefined) {
    updates.push(`meest_password = $${paramCount++}`);
    values.push(settings.meest_password);
  }
  if (settings.meest_enabled !== undefined) {
    updates.push(`meest_enabled = $${paramCount++}`);
    values.push(settings.meest_enabled);
  }
  // ... other Meest fields

  values.push(workspaceId);

  await pool.query(`
    UPDATE shops SET ${updates.join(', ')} WHERE shop_id = $${paramCount}
  `, values);

  res.json({ success: true });
});
```

---

## 10. Error Handling & Retry Logic

### API Retry Utility (`lib/api-retry.ts`)

```typescript
interface RetryOptions {
  maxRetries?: number;          // Default: 3
  initialDelayMs?: number;      // Default: 1000ms
  maxDelayMs?: number;          // Default: 10000ms
  backoffMultiplier?: number;   // Default: 2
}

interface ApiCallResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    attempts: number;
    lastError?: Error;
  };
}

// Errors that should trigger a retry
const DEFAULT_RETRYABLE_ERRORS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'socket hang up',
  'timeout',
  'rate limit',
  '429',
  '500',
  '502',
  '503',
  '504',
];

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<ApiCallResult<T>> {
  const config = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    ...options,
  };

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error) {
      lastError = error as Error;
      attempt++;

      // Check if retryable
      const errorMessage = lastError.message?.toLowerCase() || '';
      const isRetryable = DEFAULT_RETRYABLE_ERRORS.some(
        (re) => errorMessage.includes(re.toLowerCase())
      );

      if (!isRetryable || attempt > config.maxRetries) break;

      // Exponential backoff
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: {
      message: lastError?.message || 'Unknown error',
      attempts: attempt,
      lastError: lastError || undefined,
    },
  };
}
```

---

## 11. Testing

### Test Connection Function

```typescript
// Test Meest API connection
export async function testMeestConnection(
  credentials: MeestCredentials,
  shopId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await getMeestToken(credentials, shopId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
```

### Staging Test Credentials

| Field | Value |
|-------|-------|
| **Username** | `CLOSKN_test` |
| **Password** | `Kr&n9OU(1Q` |
| **Stage URL** | `https://mwl-stage.meest.com/mwl/` |

**Note:** Staging credentials have routing limitations. Production credentials will have proper route configuration.

### Sample Test Request

```bash
# Test Authentication
curl -X POST https://mwl-stage.meest.com/mwl/v2/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"CLOSKN_test","password":"Kr&n9OU(1Q"}'

# Test Parcel Creation (requires valid token)
curl -X POST https://mwl-stage.meest.com/mwl/v2/api/parcels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "parcelNumber": "TEST001",
    "serviceDetails": {"service": "ECONOMIC_STANDARD"},
    "metrics": {"dimensions": {"width": 20, "height": 15, "length": 30}, "weight": 2.5},
    "value": {"localTotalValue": 50.00, "localCurrency": "EUR"},
    "sender": {"name": "Test", "country": "GR", "zipCode": "10552", "city": "Athens", "street": "Test St", "buildingNumber": "1", "phone": "+30123456789", "email": "test@test.com"},
    "recipient": {"name": "John", "country": "PL", "zipCode": "00-001", "city": "Warsaw", "street": "Test St", "buildingNumber": "1", "phone": "+48123456789", "email": "john@test.com"},
    "items": [{"description": {"description": "Test"}, "logistic": {"quantity": 1, "weight": 2.5}, "value": {"value": 50}}]
  }'
```

---

## 12. Implementation Checklist

### Phase 1: Backend Setup
- [ ] Create `lib/couriers/meest.ts` module
- [ ] Create `lib/couriers/meest-types.ts` types
- [ ] Implement authentication (get/refresh token)
- [ ] Implement parcel creation
- [ ] Implement label retrieval (Base64 to PDF)
- [ ] Implement tracking
- [ ] Implement parcel cancellation
- [ ] Add error handling with retry logic
- [ ] Create MeestAdapter class implementing CourierAdapter interface
- [ ] Register adapter in courier router

### Phase 2: Database Setup
- [ ] Create migration file for Meest columns
- [ ] Run migration on database
- [ ] Verify columns exist

### Phase 3: Settings UI
- [ ] Add Meest credentials fields (username/password)
- [ ] Add Meest shipping options:
  - [ ] Default service dropdown
  - [ ] Default weight input
  - [ ] Package dimensions (width, height, length)
  - [ ] COD handling option
- [ ] Implement save/load settings
- [ ] Add connection status indicator

### Phase 4: API Endpoints
- [ ] Build shop settings helper function
- [ ] Create label endpoint (with courier selection)
- [ ] Download PDF endpoint
- [ ] Cancel label endpoint
- [ ] Settings update endpoint

### Phase 5: Testing
- [ ] Test authentication with staging credentials
- [ ] Test parcel creation (may need production credentials)
- [ ] Test various countries (PL, HU, BG, GR)
- [ ] Test COD orders
- [ ] Test error scenarios

---

## 13. Complete Source Files

### File Structure

```
your-project/
├── lib/
│   ├── couriers/
│   │   ├── index.ts          # Courier router
│   │   ├── types.ts          # Unified courier types
│   │   ├── meest.ts          # Meest adapter (main file)
│   │   └── meest-types.ts    # Meest-specific types
│   ├── api-retry.ts          # Retry utility
│   └── logger.ts             # Logging utility
├── migrations/
│   └── 004_meest_settings.sql
├── frontend/
│   └── app/
│       └── settings/
│           └── page.tsx      # Settings UI
└── server.ts                 # Main server with routes
```

### Dependencies Required

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "winston": "^3.11.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Summary

This document provides everything needed to implement the Meest courier integration:

1. **API Details** - URLs, authentication, endpoints
2. **Type Definitions** - Full TypeScript interfaces
3. **Database Schema** - Migration for storing settings
4. **Backend Code** - Complete adapter implementation
5. **Frontend UI** - Settings configuration
6. **Error Handling** - Retry logic and caching
7. **Testing** - Test credentials and examples

The implementation uses an **Adapter Pattern** allowing easy addition of other couriers. Simply implement the `CourierAdapter` interface and register in the router.

---

**Document Version:** 1.0
**Author:** eTrack Development Team
**Contact:** support@getetrack.com
