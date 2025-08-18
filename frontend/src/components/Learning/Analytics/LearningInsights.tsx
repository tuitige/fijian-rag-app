import React, { useState, useEffect } from 'react';
import { LearningInsight } from '../../../types/analytics';
import analyticsService from '../../../services/analyticsService';

interface LearningInsightsProps {
  userId: string;
  limit?: number;
  showRefresh?: boolean;
}

const LearningInsights: React.FC<LearningInsightsProps> = ({
  userId,
  limit = 6,
  showRefresh = true
}) => {
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInsights();
  }, [userId]);

  const loadInsights = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await analyticsService.getLearningInsights(userId);
      setInsights(data.slice(0, limit));
    } catch (error) {
      console.error('Failed to load insights:', error);
      setError('Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  };

  const getInsightTypeColor = (type: LearningInsight['type']): string => {
    switch (type) {
      case 'strength': return '#10B981';
      case 'weakness': return '#EF4444';
      case 'trend': return '#3B82F6';
      case 'recommendation': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getInsightTypeIcon = (type: LearningInsight['type']): string => {
    switch (type) {
      case 'strength': return '💪';
      case 'weakness': return '📈';
      case 'trend': return '📊';
      case 'recommendation': return '💡';
      default: return '📋';
    }
  };

  const formatMetric = (value: number, unit: string): string => {
    if (unit === '%') return `${value}%`;
    if (unit === 'days' && value === 1) return '1 day';
    if (unit === 'words' && value === 1) return '1 word';
    return `${value} ${unit}`;
  };

  if (isLoading) {
    return (
      <div style={{
        padding: 'var(--spacing-lg)',
        backgroundColor: 'var(--color-surface-elevated)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          flexDirection: 'column',
          gap: 'var(--spacing-md)'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--color-border)',
            borderTop: '3px solid var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading insights...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 'var(--spacing-lg)',
        backgroundColor: 'var(--color-surface-elevated)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        textAlign: 'center'
      }}>
        <div style={{ color: '#EF4444', marginBottom: 'var(--spacing-md)' }}>
          ❌ {error}
        </div>
        {showRefresh && (
          <button
            onClick={loadInsights}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding: 'var(--spacing-lg)',
      backgroundColor: 'var(--color-surface-elevated)',
      borderRadius: '12px',
      border: '1px solid var(--color-border)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <h3 style={{
          margin: 0,
          color: 'var(--color-text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          🧠 Learning Insights
        </h3>
        
        {showRefresh && (
          <button
            onClick={loadInsights}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}
            title="Refresh insights"
          >
            🔄 Refresh
          </button>
        )}
      </div>

      {/* Insights grid */}
      {insights.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-xl)',
          color: 'var(--color-text-secondary)',
          fontStyle: 'italic'
        }}>
          No insights available yet. Keep practicing to see your progress!
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--spacing-md)'
        }}>
          {insights.map((insight, index) => (
            <div
              key={index}
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-surface)',
                borderRadius: '8px',
                border: `1px solid var(--color-border)`,
                borderLeft: `4px solid ${getInsightTypeColor(insight.type)}`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                <span style={{ fontSize: '1.25rem' }}>
                  {insight.icon || getInsightTypeIcon(insight.type)}
                </span>
                <div>
                  <h4 style={{
                    margin: 0,
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-base)',
                    fontWeight: '600'
                  }}>
                    {insight.title}
                  </h4>
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    color: getInsightTypeColor(insight.type),
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {insight.type}
                  </span>
                </div>
              </div>

              <p style={{
                margin: '0 0 var(--spacing-sm) 0',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
                lineHeight: '1.5'
              }}>
                {insight.description}
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--spacing-xs)'
                }}>
                  <span style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: getInsightTypeColor(insight.type)
                  }}>
                    {insight.metric}
                  </span>
                  <span style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)'
                  }}>
                    {insight.unit}
                  </span>
                </div>

                {insight.change !== undefined && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    fontSize: 'var(--font-size-xs)',
                    color: insight.change >= 0 ? '#10B981' : '#EF4444'
                  }}>
                    <span>{insight.change >= 0 ? '↗️' : '↘️'}</span>
                    <span>{Math.abs(insight.change)}%</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show more button if there are more insights */}
      {insights.length >= limit && (
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--spacing-md)'
        }}>
          <button
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: 'transparent',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '500'
            }}
            onClick={() => {
              // Could implement navigation to full analytics page
              console.log('Navigate to full analytics');
            }}
          >
            View All Insights
          </button>
        </div>
      )}
    </div>
  );
};

export default LearningInsights;