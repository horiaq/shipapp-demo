'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle } from 'react-feather';
import FormSection from './FormSection';

interface GenikiSectionProps {
  apiKey: string;
  customerCode: string;
  onChange: (field: string, value: string) => void;
  onTest: () => Promise<{ success: boolean; message?: string }>;
}

export default function GenikiSection({ apiKey, customerCode, onChange, onTest }: GenikiSectionProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Connection successful!' : 'Connection failed'),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Error testing connection',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <FormSection
      title="Geniki Taxydromiki Integration"
      description="Configure courier service settings"
      color="#10b981"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
            API Key
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onChange('geniki_api_key', e.target.value)}
              placeholder="Enter your Geniki API key"
              style={{
                width: '100%',
                padding: '0.75rem 3rem 0.75rem 1rem',
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
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
            Customer Code
          </label>
          <input
            type="text"
            value={customerCode}
            onChange={(e) => onChange('geniki_customer_code', e.target.value)}
            placeholder="Your customer code"
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

        <button
          onClick={handleTest}
          disabled={testing || !apiKey}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid #10b981',
            background: testing ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
            color: '#10b981',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: testing || !apiKey ? 'not-allowed' : 'pointer',
            opacity: testing || !apiKey ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>

        {testResult && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
              border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
              color: testResult.success ? '#10b981' : 'var(--accent)',
              fontSize: '0.875rem',
            }}
          >
            {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>
    </FormSection>
  );
}


