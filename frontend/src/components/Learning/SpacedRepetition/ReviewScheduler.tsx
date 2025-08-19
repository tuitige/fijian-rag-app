import React, { useState, useEffect, useCallback } from 'react';
import { SRSCard } from '../../../types/spaced-repetition';
import { SpacedRepetitionAlgorithm } from '../../../algorithms/spacedRepetition';
import MemoryStrengthIndicator from './MemoryStrengthIndicator';
import spacedRepetitionService from '../../../services/spacedRepetitionService';

interface ReviewSchedulerProps {
  userId: string;
  onStartReview: (cards: SRSCard[]) => void;
  showUpcoming?: boolean;
}

const ReviewScheduler: React.FC<ReviewSchedulerProps> = ({
  userId,
  onStartReview,
  showUpcoming = true
}) => {
  const [dueCards, setDueCards] = useState<SRSCard[]>([]);
  const [upcomingCards, setUpcomingCards] = useState<SRSCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCards = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get all user cards
      const allCards = await spacedRepetitionService.getUserCards(userId);
      
      // Separate due and upcoming cards
      const due = SpacedRepetitionAlgorithm.getDueCards(allCards);
      const upcoming = allCards
        .filter(card => card.dueDate > new Date())
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 10); // Show next 10 upcoming

      setDueCards(due);
      setUpcomingCards(upcoming);
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
    return `In ${Math.ceil(diffDays / 30)} months`;
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'var(--spacing-xl)'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--color-border)',
          borderTop: '3px solid var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
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
      <h3 style={{
        margin: '0 0 var(--spacing-lg) 0',
        color: 'var(--color-text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)'
      }}>
        📅 Review Schedule
      </h3>

      {/* Due cards section */}
      <div style={{ marginBottom: showUpcoming ? 'var(--spacing-xl)' : 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-md)'
        }}>
          <h4 style={{
            margin: 0,
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)'
          }}>
            🔥 Due Now
            {dueCards.length > 0 && (
              <span style={{
                backgroundColor: '#EF4444',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}>
                {dueCards.length}
              </span>
            )}
          </h4>
        </div>

        {dueCards.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            color: 'var(--color-text-secondary)',
            fontStyle: 'italic'
          }}>
            🎉 No cards due for review! Great job staying on top of your studies.
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-sm)',
              marginBottom: 'var(--spacing-md)',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {dueCards.slice(0, 5).map(card => (
                <div
                  key={card.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      marginBottom: '2px'
                    }}>
                      {card.front}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)'
                    }}>
                      {card.back}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'var(--spacing-md)' }}>
                    <MemoryStrengthIndicator card={card} size="small" />
                  </div>
                </div>
              ))}
              {dueCards.length > 5 && (
                <div style={{
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-sm)',
                  fontStyle: 'italic'
                }}>
                  +{dueCards.length - 5} more cards due
                </div>
              )}
            </div>

            <button
              onClick={() => onStartReview(dueCards)}
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: 'var(--font-size-base)',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              }}
            >
              Start Review Session ({dueCards.length} cards)
            </button>
          </>
        )}
      </div>

      {/* Upcoming cards section */}
      {showUpcoming && upcomingCards.length > 0 && (
        <div>
          <h4 style={{
            margin: '0 0 var(--spacing-md) 0',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)'
          }}>
            ⏰ Upcoming Reviews
          </h4>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-xs)'
          }}>
            {upcomingCards.map(card => (
              <div
                key={card.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-sm)',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  opacity: 0.8
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)'
                  }}>
                    {card.front}
                  </div>
                </div>
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'right'
                }}>
                  {formatDate(card.dueDate)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={loadCards}
        style={{
          marginTop: 'var(--spacing-md)',
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          backgroundColor: 'transparent',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: 'var(--font-size-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          margin: 'var(--spacing-md) auto 0'
        }}
        title="Refresh schedule"
      >
        🔄 Refresh
      </button>
    </div>
  );
};

export default ReviewScheduler;