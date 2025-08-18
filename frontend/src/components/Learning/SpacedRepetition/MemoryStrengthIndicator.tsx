import React from 'react';
import { SRSCard } from '../../../types/spaced-repetition';
import { SpacedRepetitionAlgorithm } from '../../../algorithms/spacedRepetition';

interface MemoryStrengthIndicatorProps {
  card: SRSCard;
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const MemoryStrengthIndicator: React.FC<MemoryStrengthIndicatorProps> = ({
  card,
  showDetails = false,
  size = 'medium'
}) => {
  const strength = SpacedRepetitionAlgorithm.calculateMemoryStrength(card);
  const confidence = Math.min(100, card.repetitions * 20);
  
  const getStrengthColor = (strength: number): string => {
    if (strength >= 80) return '#10B981'; // Green
    if (strength >= 60) return '#F59E0B'; // Yellow
    if (strength >= 40) return '#EF4444'; // Red
    return '#6B7280'; // Gray
  };

  const getStrengthLabel = (strength: number): string => {
    if (strength >= 80) return 'Strong';
    if (strength >= 60) return 'Good';
    if (strength >= 40) return 'Weak';
    return 'New';
  };

  const sizeConfig = {
    small: { width: 60, height: 8, fontSize: '0.75rem' },
    medium: { width: 100, height: 12, fontSize: '0.875rem' },
    large: { width: 140, height: 16, fontSize: '1rem' }
  };

  const config = sizeConfig[size];

  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'Never';
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-xs)',
      minWidth: config.width
    }}>
      {/* Strength bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)'
      }}>
        <div style={{
          width: config.width,
          height: config.height,
          backgroundColor: 'var(--color-surface)',
          borderRadius: config.height / 2,
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: `${strength}%`,
            height: '100%',
            backgroundColor: getStrengthColor(strength),
            borderRadius: 'inherit',
            transition: 'width 0.3s ease'
          }} />
        </div>
        
        <span style={{
          fontSize: config.fontSize,
          fontWeight: '500',
          color: getStrengthColor(strength),
          minWidth: '45px'
        }}>
          {Math.round(strength)}%
        </span>
      </div>

      {/* Strength label */}
      <div style={{
        fontSize: config.fontSize,
        color: 'var(--color-text-secondary)',
        fontWeight: '500'
      }}>
        {getStrengthLabel(strength)}
      </div>

      {/* Detailed information */}
      {showDetails && (
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <div>
            <strong>Repetitions:</strong> {card.repetitions}
          </div>
          <div>
            <strong>Interval:</strong> {card.interval} day{card.interval !== 1 ? 's' : ''}
          </div>
          <div>
            <strong>Ease:</strong> {card.easeFactor.toFixed(1)}
          </div>
          <div>
            <strong>Due:</strong> {formatDate(card.dueDate)}
          </div>
          <div>
            <strong>Last Reviewed:</strong> {formatDate(card.lastReviewed)}
          </div>
          <div>
            <strong>Confidence:</strong> {confidence}%
          </div>
        </div>
      )}

      {/* Visual indicators */}
      <div style={{
        display: 'flex',
        gap: '4px',
        alignItems: 'center'
      }}>
        {/* Due status indicator */}
        {card.dueDate <= new Date() && (
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#EF4444',
            display: 'inline-block',
            animation: 'pulse 2s infinite'
          }} title="Due for review" />
        )}
        
        {/* High confidence indicator */}
        {confidence >= 80 && (
          <span style={{
            fontSize: '0.75rem'
          }} title="High confidence">⭐</span>
        )}
        
        {/* Recent review indicator */}
        {card.lastReviewed && 
         (Date.now() - card.lastReviewed.getTime()) < (24 * 60 * 60 * 1000) && (
          <span style={{
            fontSize: '0.75rem'
          }} title="Reviewed recently">🕒</span>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default MemoryStrengthIndicator;