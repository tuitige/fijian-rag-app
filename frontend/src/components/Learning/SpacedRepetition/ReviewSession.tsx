import React, { useState, useEffect } from 'react';
import { SRSCard, ReviewSession as ReviewSessionType, ReviewQuality } from '../../../types/spaced-repetition';
import FlashCard from './FlashCard';
import MemoryStrengthIndicator from './MemoryStrengthIndicator';
import spacedRepetitionService from '../../../services/spacedRepetitionService';

interface ReviewSessionProps {
  userId: string;
  onSessionComplete: (results: { session: ReviewSessionType; updatedCards: SRSCard[] }) => void;
  maxCards?: number;
  showProgress?: boolean;
}

const ReviewSession: React.FC<ReviewSessionProps> = ({
  userId,
  onSessionComplete,
  maxCards = 20,
  showProgress = true
}) => {
  const [session, setSession] = useState<ReviewSessionType | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showQualityButtons, setShowQualityButtons] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [responses, setResponses] = useState<{ cardId: string; quality: ReviewQuality }[]>([]);

  useEffect(() => {
    initializeSession();
  }, [userId, maxCards]);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      const newSession = await spacedRepetitionService.startReviewSession(userId, maxCards);
      
      if (newSession.cards.length === 0) {
        // No cards due for review
        onSessionComplete({
          session: { ...newSession, cardsReviewed: 0, accuracy: 0 },
          updatedCards: []
        });
        return;
      }

      setSession(newSession);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setShowQualityButtons(false);
      setResponses([]);
    } catch (error) {
      console.error('Failed to initialize review session:', error);
      // Could show error state here
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardFlip = () => {
    if (!showQualityButtons) {
      setIsFlipped(true);
      setShowQualityButtons(true);
    }
  };

  const handleQualityResponse = async (quality: ReviewQuality) => {
    if (!session) return;

    const currentCard = session.cards[currentCardIndex];
    const newResponse = { cardId: currentCard.id, quality };
    const updatedResponses = [...responses, newResponse];
    setResponses(updatedResponses);

    // Move to next card or complete session
    if (currentCardIndex < session.cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
      setShowQualityButtons(false);
    } else {
      // Session complete
      try {
        const result = await spacedRepetitionService.completeReviewSession(
          userId,
          session,
          updatedResponses
        );
        
        const finalSession = {
          ...session,
          cardsReviewed: updatedResponses.length,
          accuracy: result.sessionStats.accuracy
        };

        onSessionComplete({
          session: finalSession,
          updatedCards: result.updatedCards
        });
      } catch (error) {
        console.error('Failed to complete session:', error);
      }
    }
  };

  const getQualityButtonStyle = (quality: ReviewQuality) => {
    const baseStyle = {
      padding: 'var(--spacing-sm) var(--spacing-md)',
      margin: '0 var(--spacing-xs)',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: 'var(--font-size-sm)',
      transition: 'all 0.2s ease',
      minWidth: '80px'
    };

    const colorMap = {
      [ReviewQuality.AGAIN]: { bg: '#EF4444', color: 'white' },
      [ReviewQuality.HARD]: { bg: '#F59E0B', color: 'white' },
      [ReviewQuality.GOOD]: { bg: '#10B981', color: 'white' },
      [ReviewQuality.EASY]: { bg: '#3B82F6', color: 'white' }
    };

    return {
      ...baseStyle,
      backgroundColor: colorMap[quality].bg,
      color: colorMap[quality].color
    };
  };

  const getQualityLabel = (quality: ReviewQuality): string => {
    switch (quality) {
      case ReviewQuality.AGAIN: return 'Again';
      case ReviewQuality.HARD: return 'Hard';
      case ReviewQuality.GOOD: return 'Good';
      case ReviewQuality.EASY: return 'Easy';
      default: return 'Unknown';
    }
  };

  const getProgressPercentage = (): number => {
    if (!session || session.cards.length === 0) return 0;
    return Math.round(((currentCardIndex + (showQualityButtons ? 1 : 0)) / session.cards.length) * 100);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        flexDirection: 'column',
        gap: 'var(--spacing-md)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--color-border)',
          borderTop: '4px solid var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p>Loading review session...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!session || session.cards.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 'var(--spacing-xl)',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)'
      }}>
        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>🎉 All caught up!</h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
          No cards are due for review right now. Great job keeping up with your studies!
        </p>
        <button
          onClick={() => onSessionComplete({ session: { cards: [], sessionStart: new Date(), cardsReviewed: 0, accuracy: 0 }, updatedCards: [] })}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Continue Learning
        </button>
      </div>
    );
  }

  const currentCard = session.cards[currentCardIndex];

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: 'var(--spacing-lg)'
    }}>
      {/* Progress bar */}
      {showProgress && (
        <div style={{
          marginBottom: 'var(--spacing-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <div style={{
            flex: 1,
            height: '8px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{
              width: `${getProgressPercentage()}%`,
              height: '100%',
              backgroundColor: 'var(--color-primary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            minWidth: '60px',
            textAlign: 'right'
          }}>
            {currentCardIndex + 1} / {session.cards.length}
          </span>
        </div>
      )}

      {/* Memory strength indicator */}
      <div style={{
        marginBottom: 'var(--spacing-md)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <MemoryStrengthIndicator card={currentCard} size="small" />
      </div>

      {/* Flash card */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <FlashCard
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={handleCardFlip}
          disabled={showQualityButtons}
          showInstructions={!showQualityButtons}
        />
      </div>

      {/* Quality response buttons */}
      {showQualityButtons && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 'var(--spacing-sm)',
          marginTop: 'var(--spacing-lg)'
        }}>
          <h4 style={{
            width: '100%',
            textAlign: 'center',
            margin: '0 0 var(--spacing-md) 0',
            color: 'var(--color-text-primary)'
          }}>
            How well did you remember?
          </h4>
          
          {[ReviewQuality.AGAIN, ReviewQuality.HARD, ReviewQuality.GOOD, ReviewQuality.EASY].map(quality => (
            <button
              key={quality}
              onClick={() => handleQualityResponse(quality)}
              style={getQualityButtonStyle(quality)}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {getQualityLabel(quality)}
            </button>
          ))}
          
          <div style={{
            width: '100%',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            marginTop: 'var(--spacing-sm)'
          }}>
            <span style={{ color: '#EF4444' }}>Again</span>: Didn't remember • 
            <span style={{ color: '#F59E0B' }}> Hard</span>: Difficult to recall • 
            <span style={{ color: '#10B981' }}> Good</span>: Remembered well • 
            <span style={{ color: '#3B82F6' }}> Easy</span>: Very easy
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewSession;