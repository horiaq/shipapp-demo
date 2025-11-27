'use client';

import React, { useState } from 'react';
import { 
  ChevronDown, 
  Layers,
  DownloadCloud, 
  Upload, 
  Package,
  Trash2,
  Tag,
  Share,
  Send,
  MapPin,
  CheckCircle,
  ShoppingBag,
  FileText
} from 'react-feather';

interface BulkActionsProps {
  selectedCount: number;
  onImport: () => void;
  onExport: () => void;
  onFulfill: () => void;
  onTrack: () => void;
  onCreateInvoices: () => void;
  onDelete: () => void;
  onExportLabels: () => void;
  onSendLabels: () => void;
  onSyncFromShopify?: () => void;
}

export default function BulkActionsDropdown({
  selectedCount,
  onImport,
  onExport,
  onFulfill,
  onTrack,
  onCreateInvoices,
  onDelete,
  onExportLabels,
  onSendLabels,
  onSyncFromShopify,
}: BulkActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="bulk-actions-container" style={{ position: 'relative' }}>
      <button
        className="action-btn"
        id="bulkActionsBtn"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{ paddingRight: '1rem' }}
      >
        <Layers size={20} />
        Bulk Actions
        <ChevronDown
          size={14}
          className="bulk-chevron"
          style={{
            width: '14px',
            marginLeft: '0.25rem',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
          }}
        />
      </button>

      <div className={`bulk-dropdown ${isOpen ? 'show' : ''}`} id="bulkDropdown">
        <div className="bulk-item" onClick={() => handleAction(onImport)}>
          <DownloadCloud size={16} />
          Import New Orders
        </div>
        <div className="bulk-item" onClick={() => handleAction(onExport)}>
          <Upload size={16} />
          Export Selected
        </div>
        <div className="bulk-item" onClick={() => alert('Packing List functionality')}>
          <Package size={16} />
          Packing List
        </div>
        <div className="bulk-item" onClick={() => selectedCount > 0 && handleAction(onDelete)} style={{ color: 'var(--accent)' }}>
          <Trash2 size={16} />
          Delete Selected
        </div>
        <div className="bulk-item" onClick={() => alert('Create Labels functionality')}>
          <Tag size={16} />
          Create Labels
        </div>
        <div className="bulk-item" onClick={() => selectedCount > 0 && handleAction(onExportLabels)}>
          <Share size={16} />
          Export Labels
        </div>
        <div className="bulk-item" onClick={() => selectedCount > 0 && handleAction(onSendLabels)}>
          <Send size={16} />
          Send Labels
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.65rem',
            fontWeight: '600',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #FF6B9D 0%, #FFA07A 100%)',
            color: 'white',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 4px rgba(255, 107, 157, 0.2)'
          }}>
            Geniki Only
          </span>
        </div>
        <div className="bulk-item" onClick={() => handleAction(onTrack)}>
          <MapPin size={16} />
          Update Tracking
        </div>
        <div className="bulk-item" onClick={() => selectedCount > 0 && handleAction(onFulfill)}>
          <CheckCircle size={16} />
          Sync to Shopify
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.65rem',
            fontWeight: '600',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #95BF74, #56C568)',
            color: 'white',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 4px rgba(86, 197, 104, 0.2)'
          }}>
            Create Fulfillment
          </span>
        </div>
        <div className="bulk-item" onClick={() => selectedCount > 0 && onSyncFromShopify && handleAction(onSyncFromShopify)}>
          <ShoppingBag size={16} />
          Sync from Shopify
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.65rem',
            fontWeight: '600',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #5B8DEE, #0063F7)',
            color: 'white',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 4px rgba(91, 141, 238, 0.2)'
          }}>
            Pull Status
          </span>
        </div>
        <div className="bulk-item" onClick={() => selectedCount > 0 && handleAction(onCreateInvoices)}>
          <FileText size={16} />
          Create Invoices
        </div>
      </div>
    </div>
  );
}

