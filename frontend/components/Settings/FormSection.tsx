'use client';

import React from 'react';

interface FormSectionProps {
  title: string;
  description?: string;
  color?: string;
  children: React.ReactNode;
}

export default function FormSection({ title, description, color = 'var(--primary)', children }: FormSectionProps) {
  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: `2px solid ${color}` }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          {title}
        </h3>
        {description && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}






