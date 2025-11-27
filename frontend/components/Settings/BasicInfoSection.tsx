'use client';

import React from 'react';
import FormSection from './FormSection';

interface BasicInfoSectionProps {
  workspaceName: string;
  shopDomain: string;
  onChange: (field: string, value: string) => void;
}

export default function BasicInfoSection({ workspaceName, shopDomain, onChange }: BasicInfoSectionProps) {
  return (
    <FormSection
      title="Basic Information"
      description="General workspace settings"
      color="#06b6d4"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
            Workspace Name
          </label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => onChange('workspace_name', e.target.value)}
            placeholder="My Workspace"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              background: 'rgba(255, 255, 255, 0.5)',
              color: 'var(--text-main)',
              fontSize: '0.875rem',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.background = '#fff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-light)';
              e.target.style.background = 'rgba(255, 255, 255, 0.5)';
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
            Shop Domain
          </label>
          <input
            type="text"
            value={shopDomain}
            onChange={(e) => onChange('shop_domain', e.target.value)}
            placeholder="myshop.myshopify.com"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              background: 'rgba(255, 255, 255, 0.5)',
              color: 'var(--text-main)',
              fontSize: '0.875rem',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.background = '#fff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-light)';
              e.target.style.background = 'rgba(255, 255, 255, 0.5)';
            }}
          />
        </div>
      </div>
    </FormSection>
  );
}

