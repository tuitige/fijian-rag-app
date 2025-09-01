import React from 'react';
import { VocabularyFilters } from '../../types/vocabulary';

interface VocabularyFiltersProps {
  filters: VocabularyFilters;
  onFiltersChange: (filters: VocabularyFilters) => void;
  totalCount: number;
}

const VocabularyFiltersComponent: React.FC<VocabularyFiltersProps> = ({
  filters,
  onFiltersChange,
  totalCount
}) => {
  const handleFilterChange = (key: keyof VocabularyFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      padding: 'var(--spacing-md)',
      borderRadius: 'var(--border-radius-md)',
      border: '1px solid var(--color-border)',
      marginBottom: 'var(--spacing-lg)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-lg)',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <label style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)'
          }}>
            Definition Status:
          </label>
          <select
            value={filters.hasDefinition || ''}
            onChange={(e) => handleFilterChange('hasDefinition', e.target.value || undefined)}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)'
            }}
          >
            <option value="">All Records</option>
            <option value="false">Missing Definitions</option>
            <option value="true">Has Definitions</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <label style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)'
          }}>
            Sort By:
          </label>
          <select
            value={filters.sortBy || 'frequency'}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)'
            }}
          >
            <option value="frequency">Frequency</option>
            <option value="word">Word (A-Z)</option>
            <option value="lastSeen">Last Seen</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <label style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)'
          }}>
            Order:
          </label>
          <select
            value={filters.sortOrder || 'desc'}
            onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)'
            }}
          >
            <option value="desc">High to Low</option>
            <option value="asc">Low to High</option>
          </select>
        </div>

        <div style={{
          marginLeft: 'auto',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)'
        }}>
          Total Records: {totalCount.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default VocabularyFiltersComponent;