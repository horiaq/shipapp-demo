'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/lib/contexts/WorkspaceContext';
import { fetchWithAuth } from '@/lib/utils/api';
import { 
  Save, Loader, CheckCircle, XCircle, Settings as SettingsIcon, 
  FileText, Truck, Sliders, ShoppingBag, X, Activity, Package, Box, Briefcase, TrendingUp, Database 
} from 'react-feather';

interface Settings {
  workspace_name: string;
  workspace_slug: string;
  timezone: string;
  is_active: boolean;
  shopify_shop: string;
  shopify_access_token: string;
  shopify_api_secret: string;
  geniki_username: string;
  geniki_password: string;
  geniki_app_key: string;
  geniki_wsdl_url: string;
  oblio_email: string;
  oblio_cif: string;
  oblio_secret: string;
  oblio_series_name: string;
  oblio_vat_rate: number;
  sameday_username: string;
  sameday_password: string;
  sameday_api_key: string;
  cargus_username: string;
  cargus_password: string;
  cargus_api_key: string;
  gls_username: string;
  gls_password: string;
  gls_api_key: string;
  fancourier_username: string;
  fancourier_password: string;
  fancourier_client_id: string;
  dpd_username: string;
  dpd_password: string;
  dpd_depot_code: string;
  packeta_api_key: string;
  packeta_api_secret: string;
  posta_romana_username: string;
  posta_romana_password: string;
  posta_romana_api_key: string;
  dhl_express_api_key: string;
  dhl_express_api_secret: string;
  dhl_express_account_number: string;
  meest_username: string;
  meest_password: string;
  meest_api_key: string;
  speedy_bg_username: string;
  speedy_bg_password: string;
  speedy_bg_api_key: string;
  nemo_express_username: string;
  nemo_express_password: string;
  nemo_express_api_key: string;
  allpacka_username: string;
  allpacka_password: string;
  allpacka_api_key: string;
  speedex_username: string;
  speedex_password: string;
  speedex_api_key: string;
  econt_username: string;
  econt_password: string;
  econt_api_key: string;
  curiera_username: string;
  curiera_password: string;
  curiera_api_key: string;
  meta_ads_app_id: string;
  meta_ads_app_secret: string;
  meta_ads_access_token: string;
  meta_ads_ad_account_id: string;
  tiktok_ads_app_id: string;
  tiktok_ads_app_secret: string;
  tiktok_ads_access_token: string;
  tiktok_ads_advertiser_id: string;
  google_ads_client_id: string;
  google_ads_client_secret: string;
  google_ads_refresh_token: string;
  google_ads_customer_id: string;
  stock_feed_url: string;
  stock_feed_api_key: string;
  stock_feed_format: string;
  emag_username: string;
  emag_password: string;
  emag_api_key: string;
  smartbill_username: string;
  smartbill_token: string;
  ekonta_username: string;
  ekonta_api_key: string;
  fgo_username: string;
  fgo_password: string;
  invoice_language: string;
  invoice_currency: string;
  shipping_threshold: number;
  shipping_cost: number;
}

interface IntegrationData {
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  steps: { title: string; desc: string }[];
  fields: { label: string; type: string; placeholder?: string; value?: string; key: string }[];
}

export default function SettingsPage() {
  const { currentWorkspace, allWorkspaces, switchWorkspace, loading: workspaceLoading } = useWorkspace();
  const currentWorkspaceId = currentWorkspace?.workspace_id;
  
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIntegration, setCurrentIntegration] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [modalAlert, setModalAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState({
    shopify: false,
    geniki: false,
    oblio: false,
    sameday: false,
    cargus: false,
    gls: false,
    fancourier: false,
    dpd: false,
    packeta: false,
    posta_romana: false,
    dhl_express: false,
    meest: false,
    speedy_bg: false,
    nemo_express: false,
    allpacka: false,
    speedex: false,
    econt: false,
    curiera: false,
    meta_ads: false,
    tiktok_ads: false,
    google_ads: false,
    stock_feed: false,
    emag: false,
    smartbill: false,
    ekonta: false,
    fgo: false
  });

  useEffect(() => {
    if (currentWorkspaceId) {
      loadSettings();
    }
  }, [currentWorkspaceId]);

  // ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        closeModal();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [modalOpen]);

  const loadSettings = async () => {
    if (!currentWorkspaceId) return;
    
    try {
      const response = await fetchWithAuth(`/api/workspaces/${currentWorkspaceId}/settings`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      const ws = data.workspace;
      setSettings({
        workspace_name: ws.workspace_name || '',
        workspace_slug: ws.workspace_slug || '',
        timezone: ws.timezone || 'Europe/Athens',
        is_active: ws.is_active || false,
        shopify_shop: ws.shopify_shop || '',
        shopify_access_token: ws.shopify_access_token || '',
        shopify_api_secret: ws.shopify_api_secret || '',
        geniki_username: ws.geniki_username || '',
        geniki_password: ws.geniki_password || '',
        geniki_app_key: ws.geniki_app_key || '',
        geniki_wsdl_url: ws.geniki_wsdl_url || 'https://voucher.taxydromiki.gr/JobServicesV2.asmx?WSDL',
        oblio_email: ws.oblio_email || '',
        oblio_cif: ws.oblio_cif || '',
        oblio_secret: ws.oblio_secret || '',
        oblio_series_name: ws.oblio_series_name || '',
        oblio_vat_rate: parseFloat(ws.oblio_vat_rate) || 21.00,
        sameday_username: ws.sameday_username || '',
        sameday_password: ws.sameday_password || '',
        sameday_api_key: ws.sameday_api_key || '',
        cargus_username: ws.cargus_username || '',
        cargus_password: ws.cargus_password || '',
        cargus_api_key: ws.cargus_api_key || '',
        gls_username: ws.gls_username || '',
        gls_password: ws.gls_password || '',
        gls_api_key: ws.gls_api_key || '',
        fancourier_username: ws.fancourier_username || '',
        fancourier_password: ws.fancourier_password || '',
        fancourier_client_id: ws.fancourier_client_id || '',
        dpd_username: ws.dpd_username || '',
        dpd_password: ws.dpd_password || '',
        dpd_depot_code: ws.dpd_depot_code || '',
        packeta_api_key: ws.packeta_api_key || '',
        packeta_api_secret: ws.packeta_api_secret || '',
        posta_romana_username: ws.posta_romana_username || '',
        posta_romana_password: ws.posta_romana_password || '',
        posta_romana_api_key: ws.posta_romana_api_key || '',
        dhl_express_api_key: ws.dhl_express_api_key || '',
        dhl_express_api_secret: ws.dhl_express_api_secret || '',
        dhl_express_account_number: ws.dhl_express_account_number || '',
        meest_username: ws.meest_username || '',
        meest_password: ws.meest_password || '',
        meest_api_key: ws.meest_api_key || '',
        speedy_bg_username: ws.speedy_bg_username || '',
        speedy_bg_password: ws.speedy_bg_password || '',
        speedy_bg_api_key: ws.speedy_bg_api_key || '',
        nemo_express_username: ws.nemo_express_username || '',
        nemo_express_password: ws.nemo_express_password || '',
        nemo_express_api_key: ws.nemo_express_api_key || '',
        allpacka_username: ws.allpacka_username || '',
        allpacka_password: ws.allpacka_password || '',
        allpacka_api_key: ws.allpacka_api_key || '',
        speedex_username: ws.speedex_username || '',
        speedex_password: ws.speedex_password || '',
        speedex_api_key: ws.speedex_api_key || '',
        econt_username: ws.econt_username || '',
        econt_password: ws.econt_password || '',
        econt_api_key: ws.econt_api_key || '',
        curiera_username: ws.curiera_username || '',
        curiera_password: ws.curiera_password || '',
        curiera_api_key: ws.curiera_api_key || '',
        meta_ads_app_id: ws.meta_ads_app_id || '',
        meta_ads_app_secret: ws.meta_ads_app_secret || '',
        meta_ads_access_token: ws.meta_ads_access_token || '',
        meta_ads_ad_account_id: ws.meta_ads_ad_account_id || '',
        tiktok_ads_app_id: ws.tiktok_ads_app_id || '',
        tiktok_ads_app_secret: ws.tiktok_ads_app_secret || '',
        tiktok_ads_access_token: ws.tiktok_ads_access_token || '',
        tiktok_ads_advertiser_id: ws.tiktok_ads_advertiser_id || '',
        google_ads_client_id: ws.google_ads_client_id || '',
        google_ads_client_secret: ws.google_ads_client_secret || '',
        google_ads_refresh_token: ws.google_ads_refresh_token || '',
        google_ads_customer_id: ws.google_ads_customer_id || '',
        stock_feed_url: ws.stock_feed_url || '',
        stock_feed_api_key: ws.stock_feed_api_key || '',
        stock_feed_format: ws.stock_feed_format || 'XML',
        emag_username: ws.emag_username || '',
        emag_password: ws.emag_password || '',
        emag_api_key: ws.emag_api_key || '',
        smartbill_username: ws.smartbill_username || '',
        smartbill_token: ws.smartbill_token || '',
        ekonta_username: ws.ekonta_username || '',
        ekonta_api_key: ws.ekonta_api_key || '',
        fgo_username: ws.fgo_username || '',
        fgo_password: ws.fgo_password || '',
        invoice_language: ws.invoice_language || 'EN',
        invoice_currency: ws.invoice_currency || 'EUR',
        shipping_threshold: parseFloat(ws.shipping_threshold) || 40.00,
        shipping_cost: parseFloat(ws.shipping_cost) || 3.00,
      });

      // Check connection statuses
      setConnectionStatuses({
        shopify: Boolean(ws.shopify_shop && ws.shopify_access_token),
        geniki: Boolean(ws.geniki_username && ws.geniki_password && ws.geniki_app_key),
        oblio: Boolean(ws.oblio_email && ws.oblio_secret && ws.oblio_cif),
        sameday: Boolean(ws.sameday_username && ws.sameday_password && ws.sameday_api_key),
        cargus: Boolean(ws.cargus_username && ws.cargus_password && ws.cargus_api_key),
        gls: Boolean(ws.gls_username && ws.gls_password && ws.gls_api_key),
        fancourier: Boolean(ws.fancourier_username && ws.fancourier_password && ws.fancourier_client_id),
        dpd: Boolean(ws.dpd_username && ws.dpd_password && ws.dpd_depot_code),
        packeta: Boolean(ws.packeta_api_key && ws.packeta_api_secret),
        posta_romana: Boolean(ws.posta_romana_username && ws.posta_romana_password && ws.posta_romana_api_key),
        dhl_express: Boolean(ws.dhl_express_api_key && ws.dhl_express_api_secret && ws.dhl_express_account_number),
        meest: Boolean(ws.meest_username && ws.meest_password && ws.meest_api_key),
        speedy_bg: Boolean(ws.speedy_bg_username && ws.speedy_bg_password && ws.speedy_bg_api_key),
        nemo_express: Boolean(ws.nemo_express_username && ws.nemo_express_password && ws.nemo_express_api_key),
        allpacka: Boolean(ws.allpacka_username && ws.allpacka_password && ws.allpacka_api_key),
        speedex: Boolean(ws.speedex_username && ws.speedex_password && ws.speedex_api_key),
        econt: Boolean(ws.econt_username && ws.econt_password && ws.econt_api_key),
        curiera: Boolean(ws.curiera_username && ws.curiera_password && ws.curiera_api_key),
        meta_ads: Boolean(ws.meta_ads_app_id && ws.meta_ads_app_secret && ws.meta_ads_access_token && ws.meta_ads_ad_account_id),
        tiktok_ads: Boolean(ws.tiktok_ads_app_id && ws.tiktok_ads_app_secret && ws.tiktok_ads_access_token && ws.tiktok_ads_advertiser_id),
        google_ads: Boolean(ws.google_ads_client_id && ws.google_ads_client_secret && ws.google_ads_refresh_token && ws.google_ads_customer_id),
        stock_feed: Boolean(ws.stock_feed_url && ws.stock_feed_api_key),
        emag: Boolean(ws.emag_username && ws.emag_password && ws.emag_api_key),
        smartbill: Boolean(ws.smartbill_username && ws.smartbill_token),
        ekonta: Boolean(ws.ekonta_username && ws.ekonta_api_key),
        fgo: Boolean(ws.fgo_username && ws.fgo_password)
      });

      setLoading(false);
    } catch (error: any) {
      showAlert('error', 'Failed to load settings: ' + error.message);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentWorkspaceId || !settings) return;
    
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/workspaces/${currentWorkspaceId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      showAlert('success', '✅ Settings saved successfully!');
      loadSettings(); // Reload to update connection statuses
    } catch (error: any) {
      showAlert('error', '❌ Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const showModalAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setModalAlert({ type, message });
    setTimeout(() => setModalAlert(null), 5000);
  };

  const integrationData: Record<string, IntegrationData> = {
    shopify: {
      title: "Shopify",
      subtitle: "Connect your Shopify store to sync orders, inventory, and customers automatically.",
      icon: ShoppingBag,
      color: "linear-gradient(135deg, #96bf48, #5e8e3e)",
      steps: [
        { title: "Log in to Shopify", desc: "Go to your Shopify Admin dashboard." },
        { title: "Create App", desc: "Navigate to Apps > App and sales channel settings > Develop apps." },
        { title: "Get Credentials", desc: "Create a new app, configure scopes, and copy the API credentials." }
      ],
      fields: [
        { label: "Shop Domain", type: "text", placeholder: "store.myshopify.com", key: "shopify_shop" },
        { label: "Admin API Access Token", type: "password", key: "shopify_access_token" },
        { label: "API Secret Key", type: "password", key: "shopify_api_secret" }
      ]
    },
    geniki: {
      title: "Geniki Taxydromiki",
      subtitle: "Automate shipping label creation and tracking with Geniki Taxydromiki.",
      icon: Truck,
      color: "linear-gradient(135deg, #00529c, #003366)",
      steps: [
        { title: "Contact Sales", desc: "Request API access from your Geniki account manager." },
        { title: "Receive Keys", desc: "You will receive a username, password, and API key via email." },
        { title: "Enter Details", desc: "Input the provided credentials in the form on the right." }
      ],
      fields: [
        { label: "Username", type: "text", key: "geniki_username" },
        { label: "Password", type: "password", key: "geniki_password" },
        { label: "Application Key", type: "password", key: "geniki_app_key" },
        { label: "WSDL URL", type: "text", placeholder: "https://...", key: "geniki_wsdl_url" }
      ]
    },
    oblio: {
      title: "Oblio",
      subtitle: "Seamlessly generate invoices and sync financial data with Oblio.",
      icon: FileText,
      color: "linear-gradient(135deg, #f59e0b, #d97706)",
      steps: [
        { title: "Account Settings", desc: "Log in to Oblio and go to Settings > API." },
        { title: "Generate Key", desc: "Create a new API key for this application." },
        { title: "Configure", desc: "Enter your email and the generated secret key." }
      ],
      fields: [
        { label: "Email Address", type: "email", key: "oblio_email" },
        { label: "CIF / CUI", type: "text", key: "oblio_cif" },
        { label: "Secret Key", type: "password", key: "oblio_secret" },
        { label: "Series Name", type: "text", placeholder: "CLOGRA", key: "oblio_series_name" },
        { label: "VAT Rate (%)", type: "number", placeholder: "21.00", key: "oblio_vat_rate" }
      ]
    },
    sameday: {
      title: "Sameday Courier",
      subtitle: "Connect with Sameday Courier for fast and reliable shipping services.",
      icon: Package,
      color: "linear-gradient(135deg, #14b8a6, #06b6d4)",
      steps: [
        { title: "Create Account", desc: "Sign up or log in to your Sameday Courier account." },
        { title: "API Credentials", desc: "Navigate to Settings > API Access to generate your credentials." },
        { title: "Enter Details", desc: "Copy your username, password, and API key to the form." }
      ],
      fields: [
        { label: "Username", type: "text", key: "sameday_username" },
        { label: "Password", type: "password", key: "sameday_password" },
        { label: "API Key", type: "password", key: "sameday_api_key" }
      ]
    },
    cargus: {
      title: "Cargus",
      subtitle: "Integrate Cargus for efficient courier and logistics management.",
      icon: Box,
      color: "linear-gradient(135deg, #ef4444, #dc2626)",
      steps: [
        { title: "Register Account", desc: "Create or access your Cargus business account." },
        { title: "Get API Access", desc: "Request API credentials from Cargus support or portal." },
        { title: "Configure", desc: "Enter your username, password, and API key below." }
      ],
      fields: [
        { label: "Username", type: "text", key: "cargus_username" },
        { label: "Password", type: "password", key: "cargus_password" },
        { label: "API Key", type: "password", key: "cargus_api_key" }
      ]
    },
    gls: {
      title: "GLS",
      subtitle: "Connect with GLS for reliable international shipping and tracking.",
      icon: Truck,
      color: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
      steps: [
        { title: "GLS Account", desc: "Log in to your GLS business account portal." },
        { title: "API Setup", desc: "Navigate to Developer Tools to generate API credentials." },
        { title: "Activate", desc: "Enter your username, password, and API key to activate." }
      ],
      fields: [
        { label: "Username", type: "text", key: "gls_username" },
        { label: "Password", type: "password", key: "gls_password" },
        { label: "API Key", type: "password", key: "gls_api_key" }
      ]
    },
    fancourier: {
      title: "Fan Courier",
      subtitle: "Integrate Fan Courier for fast and efficient delivery services.",
      icon: Package,
      color: "linear-gradient(135deg, #fbbf24, #f59e0b)",
      steps: [
        { title: "Register", desc: "Create or log in to your Fan Courier business account." },
        { title: "Credentials", desc: "Request API credentials from Fan Courier support team." },
        { title: "Configure", desc: "Enter your username, password, and client ID below." }
      ],
      fields: [
        { label: "Username", type: "text", key: "fancourier_username" },
        { label: "Password", type: "password", key: "fancourier_password" },
        { label: "Client ID", type: "text", key: "fancourier_client_id" }
      ]
    },
    dpd: {
      title: "DPD",
      subtitle: "Connect with DPD for reliable parcel delivery across Europe.",
      icon: Truck,
      color: "linear-gradient(135deg, #10b981, #059669)",
      steps: [
        { title: "DPD Portal", desc: "Access your DPD business portal or create an account." },
        { title: "API Credentials", desc: "Generate API access credentials from your account settings." },
        { title: "Configure", desc: "Enter your username, password, and depot code to connect." }
      ],
      fields: [
        { label: "Username", type: "text", key: "dpd_username" },
        { label: "Password", type: "password", key: "dpd_password" },
        { label: "Depot Code", type: "text", key: "dpd_depot_code" }
      ]
    },
    packeta: {
      title: "Packeta",
      subtitle: "Integrate Packeta for pickup point and home delivery solutions.",
      icon: Box,
      color: "linear-gradient(135deg, #06b6d4, #0284c7)",
      steps: [
        { title: "Create Account", desc: "Sign up for a Packeta business account at packeta.com." },
        { title: "API Keys", desc: "Generate your API key and secret from the developer section." },
        { title: "Setup", desc: "Enter your API key and secret to enable the integration." }
      ],
      fields: [
        { label: "API Key", type: "password", key: "packeta_api_key" },
        { label: "API Secret", type: "password", key: "packeta_api_secret" }
      ]
    },
    posta_romana: {
      title: "Posta Romana",
      subtitle: "Connect with Posta Romana for nationwide postal services.",
      icon: Package,
      color: "linear-gradient(135deg, #f43f5e, #e11d48)",
      steps: [
        { title: "Business Account", desc: "Register or log in to your Posta Romana business account." },
        { title: "API Access", desc: "Request API credentials from Posta Romana support." },
        { title: "Configure", desc: "Enter your username, password, and API key to connect." }
      ],
      fields: [
        { label: "Username", type: "text", key: "posta_romana_username" },
        { label: "Password", type: "password", key: "posta_romana_password" },
        { label: "API Key", type: "password", key: "posta_romana_api_key" }
      ]
    },
    dhl_express: {
      title: "DHL Express",
      subtitle: "Global express shipping with DHL for fast international delivery.",
      icon: Truck,
      color: "linear-gradient(135deg, #fcd34d, #f59e0b)",
      steps: [
        { title: "DHL Account", desc: "Create or access your DHL Express business account." },
        { title: "API Credentials", desc: "Generate API key and secret from DHL Developer Portal." },
        { title: "Setup", desc: "Enter your API key, secret, and account number to connect." }
      ],
      fields: [
        { label: "API Key", type: "password", key: "dhl_express_api_key" },
        { label: "API Secret", type: "password", key: "dhl_express_api_secret" },
        { label: "Account Number", type: "text", key: "dhl_express_account_number" }
      ]
    },
    meest: {
      title: "Meest",
      subtitle: "Connect Meest for reliable shipping across Eastern Europe and beyond.",
      icon: Package,
      color: "linear-gradient(135deg, #22c55e, #16a34a)",
      steps: [
        { title: "Meest Account", desc: "Sign up or log in to your Meest business account." },
        { title: "API Access", desc: "Request API credentials from Meest customer support." },
        { title: "Connect", desc: "Enter your username, password, and API key to integrate." }
      ],
      fields: [
        { label: "Username", type: "text", key: "meest_username" },
        { label: "Password", type: "password", key: "meest_password" },
        { label: "API Key", type: "password", key: "meest_api_key" }
      ]
    },
    speedy_bg: {
      title: "Speedy BG",
      subtitle: "Fast and reliable courier services across Bulgaria and Europe.",
      icon: Truck,
      color: "linear-gradient(135deg, #dc2626, #991b1b)",
      steps: [
        { title: "Speedy Account", desc: "Register or access your Speedy business account." },
        { title: "Get Credentials", desc: "Obtain API credentials from Speedy customer service." },
        { title: "Configure", desc: "Enter your username, password, and API key." }
      ],
      fields: [
        { label: "Username", type: "text", key: "speedy_bg_username" },
        { label: "Password", type: "password", key: "speedy_bg_password" },
        { label: "API Key", type: "password", key: "speedy_bg_api_key" }
      ]
    },
    nemo_express: {
      title: "Nemo Express",
      subtitle: "Professional express delivery services with Nemo.",
      icon: Box,
      color: "linear-gradient(135deg, #f97316, #ea580c)",
      steps: [
        { title: "Nemo Account", desc: "Create or log in to your Nemo Express account." },
        { title: "API Setup", desc: "Request API access from Nemo Express support team." },
        { title: "Connect", desc: "Enter your credentials to enable integration." }
      ],
      fields: [
        { label: "Username", type: "text", key: "nemo_express_username" },
        { label: "Password", type: "password", key: "nemo_express_password" },
        { label: "API Key", type: "password", key: "nemo_express_api_key" }
      ]
    },
    allpacka: {
      title: "Allpacka",
      subtitle: "Comprehensive packaging and shipping solutions with Allpacka.",
      icon: Package,
      color: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
      steps: [
        { title: "Allpacka Portal", desc: "Access your Allpacka business portal." },
        { title: "API Credentials", desc: "Generate API credentials from settings." },
        { title: "Setup", desc: "Enter username, password, and API key to connect." }
      ],
      fields: [
        { label: "Username", type: "text", key: "allpacka_username" },
        { label: "Password", type: "password", key: "allpacka_password" },
        { label: "API Key", type: "password", key: "allpacka_api_key" }
      ]
    },
    speedex: {
      title: "Speedex",
      subtitle: "Connect with Speedex for express courier services in Greece.",
      icon: Truck,
      color: "linear-gradient(135deg, #0891b2, #0e7490)",
      steps: [
        { title: "Speedex Account", desc: "Log in to your Speedex courier account." },
        { title: "API Access", desc: "Contact Speedex to obtain API credentials." },
        { title: "Activate", desc: "Enter your username, password, and API key." }
      ],
      fields: [
        { label: "Username", type: "text", key: "speedex_username" },
        { label: "Password", type: "password", key: "speedex_password" },
        { label: "API Key", type: "password", key: "speedex_api_key" }
      ]
    },
    econt: {
      title: "Econt",
      subtitle: "Reliable logistics and courier services with Econt Express.",
      icon: Box,
      color: "linear-gradient(135deg, #eab308, #ca8a04)",
      steps: [
        { title: "Econt Portal", desc: "Sign in to your Econt Express business account." },
        { title: "Get API Keys", desc: "Generate API credentials from your account settings." },
        { title: "Configure", desc: "Enter your username, password, and API key." }
      ],
      fields: [
        { label: "Username", type: "text", key: "econt_username" },
        { label: "Password", type: "password", key: "econt_password" },
        { label: "API Key", type: "password", key: "econt_api_key" }
      ]
    },
    curiera: {
      title: "Curiera",
      subtitle: "Fast and efficient courier delivery services with Curiera.",
      icon: Package,
      color: "linear-gradient(135deg, #06b6d4, #0284c7)",
      steps: [
        { title: "Curiera Account", desc: "Create or access your Curiera business account." },
        { title: "API Setup", desc: "Request API credentials from Curiera support." },
        { title: "Connect", desc: "Enter your username, password, and API key to integrate." }
      ],
      fields: [
        { label: "Username", type: "text", key: "curiera_username" },
        { label: "Password", type: "password", key: "curiera_password" },
        { label: "API Key", type: "password", key: "curiera_api_key" }
      ]
    },
    meta_ads: {
      title: "Meta Ads",
      subtitle: "Track ad spend, conversions, and campaign performance from Facebook & Instagram.",
      icon: TrendingUp,
      color: "linear-gradient(135deg, #0ea5e9, #0284c7)",
      steps: [
        { title: "Meta Business", desc: "Access Meta Business Suite and go to Business Settings." },
        { title: "Create App", desc: "Create a new app in Meta for Developers to get credentials." },
        { title: "Configure", desc: "Enter your App ID, Secret, Access Token, and Ad Account ID." }
      ],
      fields: [
        { label: "App ID", type: "text", key: "meta_ads_app_id" },
        { label: "App Secret", type: "password", key: "meta_ads_app_secret" },
        { label: "Access Token", type: "password", key: "meta_ads_access_token" },
        { label: "Ad Account ID", type: "text", placeholder: "act_123456789", key: "meta_ads_ad_account_id" }
      ]
    },
    tiktok_ads: {
      title: "TikTok Ads",
      subtitle: "Monitor TikTok advertising campaigns and track ROI across the platform.",
      icon: Activity,
      color: "linear-gradient(135deg, #fe2c55, #000000)",
      steps: [
        { title: "TikTok Business", desc: "Log in to TikTok Business Center and access Developer Portal." },
        { title: "Create App", desc: "Register a new app to obtain API credentials." },
        { title: "Setup", desc: "Enter your App ID, Secret, Access Token, and Advertiser ID." }
      ],
      fields: [
        { label: "App ID", type: "text", key: "tiktok_ads_app_id" },
        { label: "App Secret", type: "password", key: "tiktok_ads_app_secret" },
        { label: "Access Token", type: "password", key: "tiktok_ads_access_token" },
        { label: "Advertiser ID", type: "text", key: "tiktok_ads_advertiser_id" }
      ]
    },
    google_ads: {
      title: "Google Ads",
      subtitle: "Connect Google Ads to track campaigns, conversions, and advertising metrics.",
      icon: TrendingUp,
      color: "linear-gradient(135deg, #4285f4, #34a853)",
      steps: [
        { title: "Google Cloud", desc: "Create a project in Google Cloud Console and enable Google Ads API." },
        { title: "OAuth Setup", desc: "Configure OAuth 2.0 credentials and generate a refresh token." },
        { title: "Connect", desc: "Enter Client ID, Secret, Refresh Token, and Customer ID." }
      ],
      fields: [
        { label: "Client ID", type: "text", key: "google_ads_client_id" },
        { label: "Client Secret", type: "password", key: "google_ads_client_secret" },
        { label: "Refresh Token", type: "password", key: "google_ads_refresh_token" },
        { label: "Customer ID", type: "text", placeholder: "123-456-7890", key: "google_ads_customer_id" }
      ]
    },
    stock_feed: {
      title: "Stock Feed",
      subtitle: "Sync real-time inventory data with product feeds and stock management systems.",
      icon: Database,
      color: "linear-gradient(135deg, #64748b, #475569)",
      steps: [
        { title: "Feed Setup", desc: "Configure your product feed endpoint or data source." },
        { title: "API Access", desc: "Generate or obtain API credentials for feed access." },
        { title: "Configure", desc: "Enter the feed URL, API key, and select your data format." }
      ],
      fields: [
        { label: "Feed URL", type: "text", placeholder: "https://example.com/feed.xml", key: "stock_feed_url" },
        { label: "API Key", type: "password", key: "stock_feed_api_key" },
        { label: "Format", type: "text", placeholder: "XML, JSON, CSV", key: "stock_feed_format" }
      ]
    },
    emag: {
      title: "Emag Marketplace",
      subtitle: "Connect with Emag to manage products, inventory, and orders automatically.",
      icon: ShoppingBag,
      color: "linear-gradient(135deg, #0066cc, #004c99)",
      steps: [
        { title: "Seller Account", desc: "Log in to your Emag Marketplace seller account." },
        { title: "API Credentials", desc: "Navigate to Settings > API to generate your credentials." },
        { title: "Connect", desc: "Enter your username, password, and API key to start syncing." }
      ],
      fields: [
        { label: "Username", type: "text", key: "emag_username" },
        { label: "Password", type: "password", key: "emag_password" },
        { label: "API Key", type: "password", key: "emag_api_key" }
      ]
    },
    smartbill: {
      title: "SmartBill",
      subtitle: "Automate invoice generation and financial reporting with SmartBill.",
      icon: Activity,
      color: "linear-gradient(135deg, #ec4899, #db2777)",
      steps: [
        { title: "Account Login", desc: "Access your SmartBill dashboard at smartbill.ro." },
        { title: "Get Token", desc: "Go to Settings > API and generate an authentication token." },
        { title: "Connect", desc: "Enter your username and token to start generating invoices." }
      ],
      fields: [
        { label: "Username", type: "text", key: "smartbill_username" },
        { label: "API Token", type: "password", key: "smartbill_token" }
      ]
    },
    ekonta: {
      title: "eKonta",
      subtitle: "Comprehensive invoicing and accounting management with eKonta.",
      icon: Briefcase,
      color: "linear-gradient(135deg, #6366f1, #4f46e5)",
      steps: [
        { title: "Create Account", desc: "Sign up or log in to your eKonta business account." },
        { title: "API Access", desc: "Navigate to Settings > Integrations to get your API key." },
        { title: "Setup", desc: "Enter your username and API key to complete the integration." }
      ],
      fields: [
        { label: "Username", type: "text", key: "ekonta_username" },
        { label: "API Key", type: "password", key: "ekonta_api_key" }
      ]
    },
    fgo: {
      title: "FGO",
      subtitle: "Professional invoicing and financial management with FGO.",
      icon: FileText,
      color: "linear-gradient(135deg, #a855f7, #9333ea)",
      steps: [
        { title: "Account Setup", desc: "Log in to your FGO account or create a new one." },
        { title: "Get Credentials", desc: "Access your account settings to retrieve login credentials." },
        { title: "Connect", desc: "Enter your username and password to integrate FGO." }
      ],
      fields: [
        { label: "Username", type: "text", key: "fgo_username" },
        { label: "Password", type: "password", key: "fgo_password" }
      ]
    }
  };

  const openModal = (integrationId: string) => {
    setCurrentIntegration(integrationId);
    // Small delay to ensure DOM is ready before adding active class
    setTimeout(() => setModalOpen(true), 10);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAlert(null); // Clear modal alerts
    // Delay clearing integration to allow exit animation
    setTimeout(() => setCurrentIntegration(null), 300);
  };

  const testConnection = async (integrationId: string) => {
    if (!currentWorkspaceId) return;
    
    setTestingConnection(true);
    setModalAlert(null); // Clear any existing alerts
    try {
      const response = await fetchWithAuth(`/api/workspaces/${currentWorkspaceId}/test-${integrationId}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        showModalAlert('success', `✅ ${integrationData[integrationId].title} connection successful!`);
        setConnectionStatuses(prev => ({ ...prev, [integrationId]: true }));
      } else {
        showModalAlert('error', `❌ Connection failed: ${data.error}`);
        setConnectionStatuses(prev => ({ ...prev, [integrationId]: false }));
      }
    } catch (error: any) {
      showModalAlert('error', `❌ Connection failed: ${error.message}`);
      setConnectionStatuses(prev => ({ ...prev, [integrationId]: false }));
    } finally {
      setTestingConnection(false);
    }
  };

  const connectIntegration = async (integrationId: string) => {
    await handleSave();
    await testConnection(integrationId);
    setTimeout(() => closeModal(), 1500);
  };

  if (workspaceLoading || loading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader className="spin" size={32} color="var(--primary)" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!currentWorkspaceId || !settings) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <XCircle size={48} color="var(--accent)" />
          <h2 style={{ marginTop: '1rem', color: 'var(--text-main)' }}>No Workspace Selected</h2>
          <p style={{ color: 'var(--text-muted)' }}>Please select a workspace from the sidebar.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-container">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.type === 'success' && <CheckCircle size={16} />}
            {alert.type === 'error' && <XCircle size={16} />}
            <span>{alert.message}</span>
          </div>
        )}

        <div className="page-header">
          <div className="page-title">
            <h1>Settings</h1>
            <p>Manage your workspace preferences and integrations.</p>
          </div>
          <button className="action-btn" onClick={handleSave} disabled={saving}>
            {saving ? <Loader className="spin" size={20} /> : <Save size={20} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* General Settings Section */}
        <div className="section-title">
          <Sliders size={18} />
          General Settings
        </div>

        <div className="settings-grid">
          {/* Basic Settings */}
          <div className="glass-card settings-card">
            <div className="card-header">
              <div className="card-icon" style={{ background: 'linear-gradient(135deg, #64748b, #475569)' }}>
                <SettingsIcon size={20} />
              </div>
              <div className="card-title">Basic Info</div>
            </div>
            <div className="form-group">
              <label className="form-label">Workspace Name</label>
              <input
                type="text"
                className="form-control"
                value={settings.workspace_name}
                onChange={(e) => setSettings({ ...settings, workspace_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Timezone</label>
              <select
                className="form-control"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              >
                <option value="Europe/Athens">Europe/Athens (GMT+2)</option>
                <option value="Europe/Bucharest">Europe/Bucharest (GMT+2)</option>
                <option value="Europe/London">Europe/London (GMT+0)</option>
                <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
                <option value="America/New_York">America/New York (GMT-5)</option>
              </select>
            </div>
          </div>

          {/* Invoice Settings */}
          <div className="glass-card settings-card">
            <div className="card-header">
              <div className="card-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                <FileText size={20} />
              </div>
              <div className="card-title">Invoicing</div>
            </div>
            <div className="form-group">
              <label className="form-label">Language</label>
              <select
                className="form-control"
                value={settings.invoice_language}
                onChange={(e) => setSettings({ ...settings, invoice_language: e.target.value })}
              >
                <option value="EN">English (EN)</option>
                <option value="EL">Greek (EL)</option>
                <option value="RO">Romanian (RO)</option>
                <option value="FR">French (FR)</option>
                <option value="DE">German (DE)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select
                className="form-control"
                value={settings.invoice_currency}
                onChange={(e) => setSettings({ ...settings, invoice_currency: e.target.value })}
              >
                <option value="EUR">Euro (€)</option>
                <option value="RON">Romanian Leu (RON)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="GBP">British Pound (£)</option>
              </select>
            </div>
          </div>

          {/* Shipping Rules */}
          <div className="glass-card settings-card">
            <div className="card-header">
              <div className="card-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>
                <Truck size={20} />
              </div>
              <div className="card-title">Shipping</div>
            </div>
            <div className="form-group">
              <label className="form-label">Free Shipping Threshold</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>€</span>
                <input
                  type="number"
                  className="form-control"
                  style={{ paddingLeft: '2.5rem' }}
                  step="0.01"
                  value={settings.shipping_threshold}
                  onChange={(e) => setSettings({ ...settings, shipping_threshold: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Standard Cost</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>€</span>
                <input
                  type="number"
                  className="form-control"
                  style={{ paddingLeft: '2.5rem' }}
                  step="0.01"
                  value={settings.shipping_cost}
                  onChange={(e) => setSettings({ ...settings, shipping_cost: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* E-commerce Integration */}
        <div className="section-title" style={{ marginTop: '3rem' }}>
          <ShoppingBag size={18} />
          E-commerce
        </div>

        <div className="integrations-grid">
          {/* Shopify */}
          <div className="integration-card" onClick={() => openModal('shopify')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/shopify.png" alt="Shopify" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Shopify</div>
              <div className="integration-desc">Sync orders and inventory</div>
            </div>
            <div className={`connection-status ${connectionStatuses.shopify ? 'connected' : ''}`}></div>
          </div>
        </div>

        {/* Shipping Integrations Section */}
        <div className="section-title" style={{ marginTop: '3rem' }}>
          <Truck size={18} />
          Shipping Integrations
        </div>

        <div className="integrations-grid">
          {/* Geniki Taxydromiki */}
          <div className="integration-card" onClick={() => openModal('geniki')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/geniki.png" alt="Geniki Taxydromiki" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Geniki Taxydromiki</div>
              <div className="integration-desc">Courier services integration</div>
            </div>
            <div className={`connection-status ${connectionStatuses.geniki ? 'connected' : ''}`}></div>
          </div>

          {/* Sameday Courier */}
          <div className="integration-card" onClick={() => openModal('sameday')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/sameday.png" alt="Sameday" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Sameday Courier</div>
              <div className="integration-desc">Fast delivery services</div>
            </div>
            <div className={`connection-status ${connectionStatuses.sameday ? 'connected' : ''}`}></div>
          </div>

          {/* Cargus */}
          <div className="integration-card" onClick={() => openModal('cargus')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/cargus.png" alt="Cargus" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Cargus</div>
              <div className="integration-desc">Courier and logistics</div>
            </div>
            <div className={`connection-status ${connectionStatuses.cargus ? 'connected' : ''}`}></div>
          </div>

          {/* GLS */}
          <div className="integration-card" onClick={() => openModal('gls')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/gls.png" alt="GLS" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">GLS</div>
              <div className="integration-desc">International shipping</div>
            </div>
            <div className={`connection-status ${connectionStatuses.gls ? 'connected' : ''}`}></div>
          </div>

          {/* Fan Courier */}
          <div className="integration-card" onClick={() => openModal('fancourier')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/fancourier.png" alt="Fan Courier" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Fan Courier</div>
              <div className="integration-desc">Express delivery services</div>
            </div>
            <div className={`connection-status ${connectionStatuses.fancourier ? 'connected' : ''}`}></div>
          </div>

          {/* DPD */}
          <div className="integration-card" onClick={() => openModal('dpd')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/dpd.png" alt="DPD" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">DPD</div>
              <div className="integration-desc">European parcel delivery</div>
            </div>
            <div className={`connection-status ${connectionStatuses.dpd ? 'connected' : ''}`}></div>
          </div>

          {/* Packeta */}
          <div className="integration-card" onClick={() => openModal('packeta')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/packeta.png" alt="Packeta" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Packeta</div>
              <div className="integration-desc">Pickup points & delivery</div>
            </div>
            <div className={`connection-status ${connectionStatuses.packeta ? 'connected' : ''}`}></div>
          </div>

          {/* Posta Romana */}
          <div className="integration-card" onClick={() => openModal('posta_romana')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/posta-romana.png" alt="Posta Romana" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Posta Romana</div>
              <div className="integration-desc">Postal services</div>
            </div>
            <div className={`connection-status ${connectionStatuses.posta_romana ? 'connected' : ''}`}></div>
          </div>

          {/* DHL Express */}
          <div className="integration-card" onClick={() => openModal('dhl_express')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/dhl.png" alt="DHL Express" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">DHL Express</div>
              <div className="integration-desc">Global express shipping</div>
            </div>
            <div className={`connection-status ${connectionStatuses.dhl_express ? 'connected' : ''}`}></div>
          </div>

          {/* Meest */}
          <div className="integration-card" onClick={() => openModal('meest')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
              <img src="/meest.png" alt="Meest" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Meest</div>
              <div className="integration-desc">Eastern Europe shipping</div>
            </div>
            <div className={`connection-status ${connectionStatuses.meest ? 'connected' : ''}`}></div>
          </div>

          {/* Speedy BG */}
          <div className="integration-card" onClick={() => openModal('speedy_bg')}>
            <div className="integration-logo" style={{ background: integrationData.speedy_bg.color }}>
              <Truck size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Speedy BG</div>
              <div className="integration-desc">Bulgaria courier services</div>
            </div>
            <div className={`connection-status ${connectionStatuses.speedy_bg ? 'connected' : ''}`}></div>
          </div>

          {/* Nemo Express */}
          <div className="integration-card" onClick={() => openModal('nemo_express')}>
            <div className="integration-logo" style={{ background: integrationData.nemo_express.color }}>
              <Box size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Nemo Express</div>
              <div className="integration-desc">Express delivery</div>
            </div>
            <div className={`connection-status ${connectionStatuses.nemo_express ? 'connected' : ''}`}></div>
          </div>

          {/* Allpacka */}
          <div className="integration-card" onClick={() => openModal('allpacka')}>
            <div className="integration-logo" style={{ background: integrationData.allpacka.color }}>
              <Package size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Allpacka</div>
              <div className="integration-desc">Packaging & shipping</div>
            </div>
            <div className={`connection-status ${connectionStatuses.allpacka ? 'connected' : ''}`}></div>
          </div>

          {/* Speedex */}
          <div className="integration-card" onClick={() => openModal('speedex')}>
            <div className="integration-logo" style={{ background: integrationData.speedex.color }}>
              <Truck size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Speedex</div>
              <div className="integration-desc">Greece express courier</div>
            </div>
            <div className={`connection-status ${connectionStatuses.speedex ? 'connected' : ''}`}></div>
          </div>

          {/* Econt */}
          <div className="integration-card" onClick={() => openModal('econt')}>
            <div className="integration-logo" style={{ background: integrationData.econt.color }}>
              <Box size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Econt</div>
              <div className="integration-desc">Logistics & courier</div>
            </div>
            <div className={`connection-status ${connectionStatuses.econt ? 'connected' : ''}`}></div>
          </div>

          {/* Curiera */}
          <div className="integration-card" onClick={() => openModal('curiera')}>
            <div className="integration-logo" style={{ background: integrationData.curiera.color }}>
              <Package size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Curiera</div>
              <div className="integration-desc">Fast courier delivery</div>
            </div>
            <div className={`connection-status ${connectionStatuses.curiera ? 'connected' : ''}`}></div>
          </div>
        </div>

        {/* Marketing Integrations Section */}
        <div className="section-title" style={{ marginTop: '3rem' }}>
          <TrendingUp size={18} />
          Marketing Integrations
        </div>

        <div className="integrations-grid">
          {/* Meta Ads */}
          <div className="integration-card" onClick={() => openModal('meta_ads')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/metalogo.png" alt="Meta" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Meta Ads</div>
              <div className="integration-desc">Facebook & Instagram ads</div>
            </div>
            <div className={`connection-status ${connectionStatuses.meta_ads ? 'connected' : ''}`}></div>
          </div>

          {/* TikTok Ads */}
          <div className="integration-card" onClick={() => openModal('tiktok_ads')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/tiktok.png" alt="TikTok" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">TikTok Ads</div>
              <div className="integration-desc">TikTok campaign tracking</div>
            </div>
            <div className={`connection-status ${connectionStatuses.tiktok_ads ? 'connected' : ''}`}></div>
          </div>

          {/* Google Ads */}
          <div className="integration-card" onClick={() => openModal('google_ads')}>
            <div className="integration-logo" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/googleads.png" alt="Google Ads" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Google Ads</div>
              <div className="integration-desc">Google advertising platform</div>
            </div>
            <div className={`connection-status ${connectionStatuses.google_ads ? 'connected' : ''}`}></div>
          </div>
        </div>

        {/* Stock Feeds Section */}
        <div className="section-title" style={{ marginTop: '3rem' }}>
          <Database size={18} />
          Stock Feeds
        </div>

        <div className="integrations-grid">
          {/* Stock Feed */}
          <div className="integration-card" onClick={() => openModal('stock_feed')}>
            <div className="integration-logo" style={{ background: integrationData.stock_feed.color }}>
              <Database size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Stock Feed</div>
              <div className="integration-desc">Real-time inventory sync</div>
            </div>
            <div className={`connection-status ${connectionStatuses.stock_feed ? 'connected' : ''}`}></div>
          </div>

          {/* Emag Marketplace */}
          <div className="integration-card" onClick={() => openModal('emag')}>
            <div className="integration-logo" style={{ background: integrationData.emag.color }}>
              <ShoppingBag size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Emag Marketplace</div>
              <div className="integration-desc">Products & orders sync</div>
            </div>
            <div className={`connection-status ${connectionStatuses.emag ? 'connected' : ''}`}></div>
          </div>
        </div>

        {/* Billing Integrations Section */}
        <div className="section-title" style={{ marginTop: '3rem' }}>
          <FileText size={18} />
          Billing Integrations
        </div>

        <div className="integrations-grid">
          {/* Oblio */}
          <div className="integration-card" onClick={() => openModal('oblio')}>
            <div className="integration-logo" style={{ background: integrationData.oblio.color }}>
              <FileText size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">Oblio</div>
              <div className="integration-desc">Invoicing and accounting</div>
            </div>
            <div className={`connection-status ${connectionStatuses.oblio ? 'connected' : ''}`}></div>
          </div>

          {/* SmartBill */}
          <div className="integration-card" onClick={() => openModal('smartbill')}>
            <div className="integration-logo" style={{ background: integrationData.smartbill.color }}>
              <Activity size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">SmartBill</div>
              <div className="integration-desc">Invoice automation</div>
            </div>
            <div className={`connection-status ${connectionStatuses.smartbill ? 'connected' : ''}`}></div>
          </div>

          {/* eKonta */}
          <div className="integration-card" onClick={() => openModal('ekonta')}>
            <div className="integration-logo" style={{ background: integrationData.ekonta.color }}>
              <Briefcase size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">eKonta</div>
              <div className="integration-desc">Invoicing & accounting</div>
            </div>
            <div className={`connection-status ${connectionStatuses.ekonta ? 'connected' : ''}`}></div>
          </div>

          {/* FGO */}
          <div className="integration-card" onClick={() => openModal('fgo')}>
            <div className="integration-logo" style={{ background: integrationData.fgo.color }}>
              <FileText size={24} />
            </div>
            <div className="integration-info">
              <div className="integration-name">FGO</div>
              <div className="integration-desc">Financial management</div>
            </div>
            <div className={`connection-status ${connectionStatuses.fgo ? 'connected' : ''}`}></div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {currentIntegration && (
        <div className={`integration-modal-overlay ${modalOpen ? 'active' : ''}`} onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains('integration-modal-overlay')) {
            closeModal();
          }
        }}>
          <div className="integration-modal-window">
            <div className="integration-modal-close" onClick={closeModal}>
              <X size={16} />
            </div>

            {/* Modal Left */}
            <div className="integration-modal-left">
              <div className="integration-modal-icon-large" style={{ 
                background: (currentIntegration === 'meta_ads' || currentIntegration === 'tiktok_ads' || currentIntegration === 'google_ads') ? 'transparent' : integrationData[currentIntegration].color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {currentIntegration === 'meta_ads' ? (
                  <img src="/metalogo.png" alt="Meta" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'tiktok_ads' ? (
                  <img src="/tiktok.png" alt="TikTok" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'google_ads' ? (
                  <img src="/googleads.png" alt="Google Ads" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'shopify' ? (
                  <img src="/shopify.png" alt="Shopify" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'geniki' ? (
                  <img src="/geniki.png" alt="Geniki Taxydromiki" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'dhl_express' ? (
                  <img src="/dhl.png" alt="DHL Express" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'posta_romana' ? (
                  <img src="/posta-romana.png" alt="Posta Romana" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'dpd' ? (
                  <img src="/dpd.png" alt="DPD" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'packeta' ? (
                  <img src="/packeta.png" alt="Packeta" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'meest' ? (
                  <img src="/meest.png" alt="Meest" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'sameday' ? (
                  <img src="/sameday.png" alt="Sameday" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'cargus' ? (
                  <img src="/cargus.png" alt="Cargus" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'gls' ? (
                  <img src="/gls.png" alt="GLS" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : currentIntegration === 'fancourier' ? (
                  <img src="/fancourier.png" alt="Fan Courier" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                ) : (
                  React.createElement(integrationData[currentIntegration].icon, { size: 32 })
                )}
              </div>
              <h2 className="integration-modal-title">{integrationData[currentIntegration].title}</h2>
              <p className="integration-modal-subtitle">{integrationData[currentIntegration].subtitle}</p>
              
              <div className="integration-guide-steps">
                {integrationData[currentIntegration].steps.map((step, index) => (
                  <div key={index} className="integration-guide-step">
                    <div className="integration-step-number">{index + 1}</div>
                    <div className="integration-step-content">
                      <strong>{step.title}</strong>
                      {step.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Right */}
            <div className="integration-modal-right">
              {modalAlert && (
                <div className={`alert alert-${modalAlert.type}`} style={{ marginBottom: '1.5rem' }}>
                  {modalAlert.type === 'success' && <CheckCircle size={16} />}
                  {modalAlert.type === 'error' && <XCircle size={16} />}
                  <span>{modalAlert.message}</span>
                </div>
              )}
              <div className="integration-modal-form">
                {integrationData[currentIntegration].fields.map((field, index) => {
                  const fields = integrationData[currentIntegration].fields;
                  const isOblio = currentIntegration === 'oblio';
                  const isLastTwoFields = isOblio && index >= fields.length - 2;
                  
                  // For Oblio, render last two fields in a row
                  if (isOblio && index === fields.length - 2) {
                    return (
                      <div key={index} className="form-row">
                        <div className="form-group">
                          <label className="form-label">{field.label}</label>
                          <input
                            type={field.type}
                            className="form-control"
                            placeholder={field.placeholder || ''}
                            value={(settings as any)[field.key] || ''}
                            onChange={(e) => {
                              const value = field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                              setSettings({ ...settings, [field.key]: value });
                            }}
                            step={field.type === 'number' ? '0.01' : undefined}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{fields[index + 1].label}</label>
                          <input
                            type={fields[index + 1].type}
                            className="form-control"
                            placeholder={fields[index + 1].placeholder || ''}
                            value={(settings as any)[fields[index + 1].key] || ''}
                            onChange={(e) => {
                              const value = fields[index + 1].type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                              setSettings({ ...settings, [fields[index + 1].key]: value });
                            }}
                            step={fields[index + 1].type === 'number' ? '0.01' : undefined}
                          />
                        </div>
                      </div>
                    );
                  }
                  
                  // Skip the last field for Oblio (already rendered above)
                  if (isOblio && index === fields.length - 1) {
                    return null;
                  }
                  
                  // Regular field rendering
                  return (
                    <div key={index} className="form-group">
                      <label className="form-label">{field.label}</label>
                      <input
                        type={field.type}
                        className="form-control"
                        placeholder={field.placeholder || ''}
                        value={(settings as any)[field.key] || ''}
                        onChange={(e) => {
                          const value = field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                          setSettings({ ...settings, [field.key]: value });
                        }}
                        step={field.type === 'number' ? '0.01' : undefined}
                      />
                    </div>
                  );
                })}
                
                <div className="integration-modal-actions">
                  <button className="btn-outline" onClick={closeModal}>Cancel</button>
                  <button 
                    className="btn-outline" 
                    onClick={() => testConnection(currentIntegration)}
                    disabled={testingConnection}
                    style={{ 
                      marginLeft: 'auto',
                      borderColor: testingConnection ? 'var(--primary)' : undefined 
                    }}
                  >
                    {testingConnection ? (
                      <>
                        <Loader className="spin" size={16} /> Testing...
                      </>
                    ) : (
                      <>
                        {connectionStatuses[currentIntegration as keyof typeof connectionStatuses] ? (
                          <CheckCircle size={16} />
                        ) : (
                          <Activity size={16} />
                        )}
                        Test Connection
                      </>
                    )}
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={() => connectIntegration(currentIntegration)}
                    disabled={saving || testingConnection}
                  >
                    {saving ? (
                      <>
                        <Loader className="spin" size={16} /> Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} /> Save & Connect
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
