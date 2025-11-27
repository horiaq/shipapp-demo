'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'react-feather';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  ordersPerPage: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalOrders,
  ordersPerPage,
  onPageChange,
}: PaginationProps) {
  const startOrder = (currentPage - 1) * ordersPerPage + 1;
  const endOrder = Math.min(currentPage * ordersPerPage, totalOrders);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        borderTop: '1px solid var(--border-light)',
      }}
    >
      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Showing <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{startOrder}-{endOrder}</span> of{' '}
        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{totalOrders.toLocaleString()}</span> orders
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className={`page-btn ${currentPage === 1 ? 'disabled' : ''}`}
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
              >
                ...
              </span>
            );
          }

          return (
            <button
              key={page}
              className={`page-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => onPageChange(page as number)}
            >
              {page}
            </button>
          );
        })}
        <button
          className={`page-btn ${currentPage === totalPages ? 'disabled' : ''}`}
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

