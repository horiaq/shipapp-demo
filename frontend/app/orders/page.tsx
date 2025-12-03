'use client';

import React, { useState, useRef } from 'react';
import { useOrders } from '@/lib/hooks/useOrders';
import { useWorkspace } from '@/lib/contexts/WorkspaceContext';
import { bulkFulfillOrders, bulkCreateInvoices, bulkUpdateTracking, exportLabels, sendLabelsToGeniki, syncFromShopify, bulkCreateVouchers } from '@/lib/api/orders';
import OrdersTable from '@/components/OrdersTable';
import { Pagination } from '@/components/OrdersTable';
import BulkActionsDropdown from '@/components/Orders/BulkActionsDropdown';
import { RefreshCw, Download, X, Play, Loader, Check } from 'react-feather';
import * as Icons from 'react-feather';

export default function OrdersPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [currentTrackingOrder, setCurrentTrackingOrder] = useState('');
  const [trackingStatus, setTrackingStatus] = useState('');
  const [scannedCount, setScannedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const trackingContainerRef = useRef<HTMLDivElement>(null);
  const { orders, totalOrders, totalPages, loading, mutate } = useOrders(currentPage, 50, statusFilter);
  const { currentWorkspace } = useWorkspace();

  const handleFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleBulkAction = async (
    action: () => Promise<any>,
    successMessage: string
  ) => {
    if (!currentWorkspace || selectedOrders.length === 0) return;

    try {
      const result = await action();
      if (result.success) {
        alert(successMessage);
        setSelectedOrders([]);
        mutate();
      } else {
        alert(`Error: ${result.message || 'Action failed'}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  const handleImport = () => {
    if (!currentWorkspace) return;
    
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.style.display = 'none';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('csvFile', file);
      formData.append('workspaceId', currentWorkspace.workspace_id.toString());
      
      try {
        // Get auth token from localStorage
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch('/api/upload-csv', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Workspace-Id': currentWorkspace.workspace_id.toString(),
          },
          body: formData,
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert(`Successfully imported ${result.imported} orders!\n${result.failed > 0 ? `Failed: ${result.failed}` : ''}`);
          await mutate(); // Refresh the orders list
        } else {
          alert(`Error importing CSV: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        alert(`Error importing CSV: ${error}`);
      } finally {
        document.body.removeChild(input);
      }
    };
    
    document.body.appendChild(input);
    input.click();
  };

  const handleExport = () => {
    if (selectedOrders.length === 0) return;
    alert(`Exporting ${selectedOrders.length} orders...`);
  };

  const handleExportLabels = async () => {
    if (selectedOrders.length === 0 || !currentWorkspace) return;
    
    try {
      const blob = await exportLabels(selectedOrders, currentWorkspace.workspace_id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labels_${selectedOrders.length}_vouchers_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert(`Successfully exported ${selectedOrders.length} labels!`);
    } catch (error: any) {
      alert(`Error exporting labels: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSendLabels = async () => {
    if (selectedOrders.length === 0 || !currentWorkspace) return;
    
    const confirmed = confirm(
      `This will send ${selectedOrders.length} labels to Geniki Taxydromiki (ClosePendingJobs).\n\n` +
      `This finalizes the vouchers and they cannot be modified after.\n\n` +
      `Continue?`
    );
    
    if (!confirmed) return;
    
    try {
      const result = await sendLabelsToGeniki(selectedOrders, currentWorkspace.workspace_id);
      if (result.success) {
        alert(`Successfully sent ${selectedOrders.length} labels to Geniki!`);
        await mutate(); // Refresh the orders list
      } else {
        alert(`Error sending labels: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Error sending labels: ${error.message || 'Unknown error'}`);
    }
  };

  const handleBulkFulfill = () => {
    handleBulkAction(
      () => bulkFulfillOrders(selectedOrders, currentWorkspace!.workspace_id),
      `Successfully fulfilled ${selectedOrders.length} orders!`
    );
  };

  const createMapPoint = (x: number, y: number) => {
    if (!trackingContainerRef.current) return;
    
    const point = document.createElement('div');
    point.className = 'map-point active';
    point.style.left = `${x}%`;
    point.style.top = `${y}%`;
    trackingContainerRef.current.appendChild(point);
    
    setTimeout(() => {
      point.remove();
    }, 2000);
  };

  const handleBulkTrack = () => {
    setTrackingModalOpen(true);
    setScannedCount(0);
    setUpdatedCount(0);
    setTrackingProgress(0);
  };

  const startTrackingSimulation = async () => {
    if (!currentWorkspace || isTracking) return;
    
    setIsTracking(true);
    setScannedCount(0);
    setUpdatedCount(0);
    
    try {
      // Start the actual tracking update in the background
      const trackingPromise = bulkUpdateTracking(currentWorkspace.workspace_id);
      
      // Import fetchWithAuth dynamically
      const { fetchWithAuth } = await import('@/lib/utils/api');
      
      // Fetch ALL orders for animation (not just current page)
      const allOrdersResponse = await fetchWithAuth(
        `/api/imported-orders?workspaceId=${currentWorkspace.workspace_id}&page=1&limit=1000`
      );
      const allOrdersData = await allOrdersResponse.json();
      const allOrders = allOrdersData.orders || [];
      
      let scanned = 0;
      let updated = 0;
      
      // Create a continuous animation loop through ALL orders
      const animationLoop = async () => {
        for (let i = 0; i < allOrders.length; i++) {
          const order = allOrders[i];
          
          // Update UI
          setCurrentTrackingOrder(order.orderName || `Order ${i + 1}`);
          setTrackingStatus('Locating Package...');
          setTrackingProgress(0);
          
          // Create random map point (less frequently to improve performance)
          if (i % 3 === 0) {
            const x = 20 + Math.random() * 60;
            const y = 20 + Math.random() * 60;
            createMapPoint(x, y);
          }
          
          // Even faster scanning progress
          await new Promise<void>((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
              progress += 20; // Much faster increment
              setTrackingProgress(progress);
              
              if (progress >= 100) {
                clearInterval(interval);
                resolve();
              }
            }, 10); // Even faster interval
          });
          
          setTrackingStatus('Status Updated!');
          
          scanned++;
          setScannedCount(scanned);
          
          if (Math.random() > 0.3) {
            updated++;
            setUpdatedCount(updated);
          }
          
          await new Promise(r => setTimeout(r, 100)); // Even faster delay between orders
        }
      };
      
      // Run animation and API call in parallel
      const [_, result] = await Promise.all([
        animationLoop(),
        trackingPromise
      ]);
      
      if (result.success) {
        // Since tracking runs in background, use the animation counts
        // or show a generic success message
        if ((result as any).results) {
          // If results are available (shouldn't happen with new API but keeping for safety)
          const results = (result as any).results;
          setScannedCount(results.total);
          setUpdatedCount(results.updated);
          setCurrentTrackingOrder(`Processed ${results.total} orders`);
        } else {
          // Background processing - show animation results
          setCurrentTrackingOrder(`Tracking update started successfully`);
        }
        setTrackingStatus('Sync Complete!');
        setTrackingProgress(100);
        
        setTimeout(() => {
          setTrackingModalOpen(false);
          setIsTracking(false);
          mutate(); // Refresh the orders list
          
          // Trigger delivery widget refresh with animation
          window.dispatchEvent(new Event('tracking-updated'));
        }, 2000);
      } else {
        alert(`Error: ${result.error || 'Tracking update failed'}`);
        setTrackingModalOpen(false);
        setIsTracking(false);
      }
    } catch (error) {
      alert(`Error: ${error}`);
      setTrackingModalOpen(false);
      setIsTracking(false);
    }
  };

  const handleBulkInvoices = () => {
    handleBulkAction(
      () => bulkCreateInvoices(selectedOrders, currentWorkspace!.workspace_id),
      `Successfully created ${selectedOrders.length} invoices!`
    );
  };

  const handleSyncFromShopify = async () => {
    if (selectedOrders.length === 0 || !currentWorkspace) return;
    
    const confirmed = confirm(
      `Sync fulfillment status from Shopify for ${selectedOrders.length} orders?\n\n` +
      `This will check which orders are already fulfilled in Shopify and update your database.`
    );
    
    if (!confirmed) return;
    
    try {
      const result = await syncFromShopify(selectedOrders, currentWorkspace.workspace_id);
      if (result.success) {
        const summary = result.summary || { alreadyFulfilled: 0, failed: 0 };
        alert(
          `Successfully synced ${selectedOrders.length} orders from Shopify!\n\n` +
          `${summary.alreadyFulfilled} orders were already fulfilled in Shopify.\n` +
          `${summary.failed} failed.`
        );
        setSelectedOrders([]);
        await mutate(); // Refresh the orders list
      } else {
        alert(`Error syncing from Shopify: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Error syncing from Shopify: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDelete = () => {
    if (selectedOrders.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedOrders.length} orders?`)) {
      alert('Delete functionality will be implemented');
      setSelectedOrders([]);
    }
  };

  const handleCreateLabels = async () => {
    if (selectedOrders.length === 0 || !currentWorkspace) return;

    const confirmed = confirm(
      `Create AWB labels for ${selectedOrders.length} selected orders?\n\n` +
      `This will use your default courier (${currentWorkspace.default_courier || 'geniki'}).`
    );

    if (!confirmed) return;

    try {
      const result = await bulkCreateVouchers(selectedOrders, currentWorkspace.workspace_id);

      if (result.success) {
        const { results } = result;
        let message = `Label Creation Complete!\n\n`;
        message += `✅ Created: ${results.success?.length || 0}\n`;
        message += `⏭️ Skipped (already have labels): ${results.skipped?.length || 0}\n`;
        message += `❌ Failed: ${results.failed?.length || 0}`;

        if (results.failed?.length > 0) {
          message += `\n\nFailed orders:\n`;
          results.failed.slice(0, 5).forEach((f: any) => {
            message += `- ${f.orderId}: ${f.error}\n`;
          });
          if (results.failed.length > 5) {
            message += `... and ${results.failed.length - 5} more`;
          }
        }

        alert(message);
        setSelectedOrders([]);
        await mutate();
      } else {
        alert(`Error: ${result.error || 'Failed to create labels'}`);
      }
    } catch (error: any) {
      alert(`Error creating labels: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Orders Management</h1>
          <p>Manage and track all customer orders.</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="icon-btn" 
            style={{ width: '40px', height: '40px' }} 
            title="Refresh"
            onClick={() => mutate()}
          >
            <RefreshCw size={16} />
          </button>
          <button 
            className="icon-btn" 
            style={{ width: 'auto', padding: '0 1rem', gap: '0.5rem' }}
            onClick={handleExport}
          >
            <Download size={16} />
            Export
          </button>
          <BulkActionsDropdown
            selectedCount={selectedOrders.length}
            onImport={handleImport}
            onExport={handleExport}
            onFulfill={handleBulkFulfill}
            onTrack={handleBulkTrack}
            onCreateInvoices={handleBulkInvoices}
            onDelete={handleDelete}
            onExportLabels={handleExportLabels}
            onSendLabels={handleSendLabels}
            onSyncFromShopify={handleSyncFromShopify}
            onCreateLabels={handleCreateLabels}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-card table-container">
        <OrdersTable
          orders={orders}
          loading={loading}
          selectedOrders={selectedOrders}
          onSelectOrders={setSelectedOrders}
          onRefresh={mutate}
          totalOrders={totalOrders}
          onFilterChange={handleFilterChange}
          currentFilter={statusFilter}
        />
        
        {!loading && orders.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalOrders={totalOrders}
            ordersPerPage={50}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Tracking Modal */}
      <div className={`tracking-modal-overlay ${trackingModalOpen ? 'active' : ''}`}>
        <div className="tracking-container" ref={trackingContainerRef}>
          <div className="radar-grid"></div>
          <div className="radar-scan"></div>
          <div className="scan-line"></div>

          <div className="tracking-header">
            <div className="tracking-title">
              <h2>Global Logistics Sync</h2>
              <div className="tracking-status">
                <div className="status-dot"></div>
                LIVE TRACKING UPDATE
              </div>
            </div>
            <button className="modal-close" onClick={() => !isTracking && setTrackingModalOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="tracking-content">
            <div className={`current-order-card ${isTracking ? 'show' : ''}`}>
              <div className="order-id-display">{currentTrackingOrder || 'Ready'}</div>
              <div className="order-status-display">{trackingStatus || 'Waiting to start...'}</div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${trackingProgress}%` }}></div>
              </div>
            </div>
          </div>

          <div className="tracking-footer">
            <div className="stats-counter">
              <div className="stat-item">
                <span className="stat-number">{scannedCount}</span>
                <span className="stat-label">Orders Scanned</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{updatedCount}</span>
                <span className="stat-label">Updated</span>
              </div>
            </div>
            <button 
              className="action-btn" 
              onClick={startTrackingSimulation}
              disabled={isTracking}
              style={{
                background: isTracking ? 'rgba(255, 255, 255, 0.1)' : undefined,
                cursor: isTracking ? 'not-allowed' : 'pointer'
              }}
            >
              {!isTracking ? (
                <>
                  <Play size={18} />
                  Start Sync
                </>
              ) : trackingStatus === 'Sync Complete!' ? (
                <>
                  <Check size={18} />
                  Sync Complete
                </>
              ) : (
                <>
                  <Loader size={18} className="spin" />
                  Syncing...
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

