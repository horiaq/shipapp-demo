'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Package, Activity } from 'react-feather';
import { formatPrice } from '@/lib/utils/orderHelpers';
import { useWorkspace } from '@/lib/contexts/WorkspaceContext';

interface TooltipProps {
  trigger: React.ReactNode;
  type: 'address' | 'products' | 'status';
  data: any;
}

export default function CustomTooltip({ trigger, type, data }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.invoice_currency || 'EUR';

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;

    if (tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      let left = x + 15;
      let top = y + 15;

      // Check bounds to prevent overflow
      if (left + tooltipRect.width > winWidth) {
        left = x - tooltipRect.width - 15;
      }

      if (top + tooltipRect.height > winHeight) {
        top = y - tooltipRect.height - 15;
      }

      setPosition({ x: left, y: top });
    } else {
      // Set initial position even if tooltip isn't rendered yet
      setPosition({ x: x + 15, y: y + 15 });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsVisible(true);
    updatePosition(e);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    updatePosition(e);
  };

  const renderTooltipContent = () => {
    switch (type) {
      case 'address':
        const fullAddress = [
          data.address1,
          data.address2,
          `${data.city}, ${data.zip}`,
          data.country,
          data.phone ? `📞 ${data.phone}` : null
        ].filter(Boolean).join('<br/>');
        
        return (
          <>
            <div className="tooltip-header">
              <MapPin size={14} />
              Shipping Address
            </div>
            <div className="tooltip-content" style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
              <div dangerouslySetInnerHTML={{ __html: fullAddress }} />
            </div>
          </>
        );

      case 'products':
        return (
          <>
            <div className="tooltip-header">
              <Package size={14} />
              Order Contents
            </div>
            <div className="tooltip-content">
              {data.products && data.products.length > 0 ? (
                data.products.map((product: any, index: number) => (
                  <div key={`${product.name}-${index}`} className="tooltip-item">
                    <div className="tooltip-item-icon">
                      <Package size={16} />
                    </div>
                    <div className="tooltip-item-details">
                      <div className="tooltip-item-name">
                        {product.quantity}x {product.name || product.title}
                      </div>
                      <div className="tooltip-item-meta">
                        {formatPrice(product.price, currency)} each
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>No products</div>
              )}
            </div>
          </>
        );

      case 'status':
        const timeline = [];
        
        if (data.importedAt) {
          timeline.push({
            title: 'Order Placed',
            date: new Date(data.importedAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            completed: true
          });
        }
        
        if (data.voucherCreatedAt) {
          timeline.push({
            title: 'Order Shipped',
            date: new Date(data.voucherCreatedAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            completed: true
          });
        }
        
        if (data.deliveredAt) {
          timeline.push({
            title: 'Delivered',
            date: new Date(data.deliveredAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            completed: true,
            current: true
          });
        } else if (data.voucherCreatedAt) {
          timeline.push({
            title: 'Out for Delivery',
            date: 'In Progress',
            completed: false,
            current: true
          });
        }
        
        if (data.invoicedAt) {
          timeline.push({
            title: 'Invoiced',
            date: new Date(data.invoicedAt).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            completed: true
          });
        }
        
        return (
          <>
            <div className="tooltip-header">
              <Activity size={14} />
              Order History
            </div>
            <div className="tooltip-content">
              <div className="timeline">
                {timeline.map((event, index) => (
                  <div
                    key={index}
                    className={`timeline-item ${event.completed ? 'completed' : ''} ${event.current ? 'current' : ''}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div className="timeline-title">{event.title}</div>
                      <div className="timeline-date">{event.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const tooltipContent = isVisible && mounted ? (
    <div
      ref={tooltipRef}
      className={`custom-tooltip ${isVisible ? 'show' : ''}`}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
      }}
    >
      {renderTooltipContent()}
    </div>
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        style={{ display: 'block', width: '100%', maxWidth: '100%' }}
      >
        {trigger}
      </div>
      {mounted && tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  );
}

