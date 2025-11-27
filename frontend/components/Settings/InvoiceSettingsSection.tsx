'use client';

import React from 'react';
import FormSection from './FormSection';

interface InvoiceSettingsSectionProps {
  seriesName: string;
  vatRate: string;
  onChange: (field: string, value: string) => void;
}

export default function InvoiceSettingsSection({ seriesName, vatRate, onChange }: InvoiceSettingsSectionProps) {
  return (
    <FormSection
      title="Invoice Settings"
      description="Configure invoice generation preferences"
      color="#ec4899"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
            Invoice Series Name
          </label>
          <input
            type="text"
            value={seriesName}
            onChange={(e) => onChange('oblio_series_name', e.target.value)}
            placeholder="FCT"
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
          <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            The series name for your invoices in Oblio
          </p>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
            VAT Rate (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={vatRate}
            onChange={(e) => onChange('oblio_vat_rate', e.target.value)}
            placeholder="19.00"
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
          <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Standard VAT rate for your country (e.g., 19% for Romania, 24% for Greece)
          </p>
        </div>
      </div>
    </FormSection>
  );
}

