import React, { useState, useEffect } from 'react';
import { VocabularyRecord, VocabularyListResponse, VocabularyFilters } from '../../types/vocabulary';
import VocabularyManagementService from '../../services/vocabularyManagementService';
import VocabularyTable from './VocabularyTable';
import VocabularyFiltersComponent from './VocabularyFilters';
import EditDefinitionModal from './EditDefinitionModal';

const VocabularyManagement: React.FC = () => {
  const [vocabularyData, setVocabularyData] = useState<VocabularyListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<VocabularyFilters>({
    hasDefinition: undefined,
    sortBy: 'frequency',
    sortOrder: 'desc',
    limit: 50
  });
  const [editingWord, setEditingWord] = useState<VocabularyRecord | null>(null);

  const loadVocabulary = async (newFilters?: VocabularyFilters, append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      }

      const currentFilters = newFilters || filters;
      const response = await VocabularyManagementService.getVocabulary(currentFilters);
      
      if (append && vocabularyData) {
        setVocabularyData({
          ...response,
          items: [...vocabularyData.items, ...response.items]
        });
      } else {
        setVocabularyData(response);
      }
    } catch (err) {
      console.error('Error loading vocabulary:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vocabulary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await VocabularyManagementService.getVocabulary({
          hasDefinition: undefined,
          sortBy: 'frequency',
          sortOrder: 'desc',
          limit: 50
        });
        setVocabularyData(response);
      } catch (err) {
        console.error('Error loading vocabulary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load vocabulary');
      } finally {
        setLoading(false);
      }
    };

    initialLoad();
  }, []); // Only run on mount

  const handleFiltersChange = (newFilters: VocabularyFilters) => {
    const updatedFilters = { ...newFilters, lastEvaluatedKey: undefined };
    setFilters(updatedFilters);
    loadVocabulary(updatedFilters);
  };

  const handleLoadMore = () => {
    if (vocabularyData?.hasMore && vocabularyData.lastEvaluatedKey) {
      const nextPageFilters = {
        ...filters,
        lastEvaluatedKey: vocabularyData.lastEvaluatedKey
      };
      loadVocabulary(nextPageFilters, true);
    }
  };

  const handleEditDefinition = (word: VocabularyRecord) => {
    setEditingWord(word);
  };

  const handleDefinitionUpdated = (updatedRecord: VocabularyRecord) => {
    if (vocabularyData) {
      const updatedItems = vocabularyData.items.map(item =>
        item.word === updatedRecord.word ? updatedRecord : item
      );
      setVocabularyData({
        ...vocabularyData,
        items: updatedItems
      });
    }
    setEditingWord(null);
  };

  const handleCloseModal = () => {
    setEditingWord(null);
  };

  if (loading && !vocabularyData) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        flexDirection: 'column',
        gap: 'var(--spacing-md)'
      }}>
        <div className="spinner" style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--color-border)',
          borderTop: '3px solid var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <span>Loading vocabulary data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: 'var(--spacing-xl)',
        textAlign: 'center',
        color: 'var(--color-error)'
      }}>
        <h3>Error Loading Vocabulary</h3>
        <p>{error}</p>
        <button 
          onClick={() => loadVocabulary()}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius-sm)',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: 'var(--spacing-xl)',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h2 style={{ 
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          Vocabulary Data Management
        </h2>
        <p style={{ 
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
          margin: 0
        }}>
          Manage and curate Fijian vocabulary definitions. Words are sorted by frequency of use in the corpus.
        </p>
      </div>

      <VocabularyFiltersComponent 
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalCount={vocabularyData?.total || 0}
      />

      <VocabularyTable
        data={vocabularyData?.items || []}
        loading={loading}
        onEditDefinition={handleEditDefinition}
        onLoadMore={vocabularyData?.hasMore ? handleLoadMore : undefined}
      />

      {editingWord && (
        <EditDefinitionModal
          word={editingWord}
          onDefinitionUpdated={handleDefinitionUpdated}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default VocabularyManagement;