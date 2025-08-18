import React, { useState, useEffect } from 'react';
import { ExerciseQuestion } from '../../../types/exercises';

interface MultipleChoiceProps {
  question: ExerciseQuestion;
  onSubmit: (answer: string, timeSpent: number, hintsUsed: number) => Promise<{ isCorrect: boolean; explanation?: string }>;
  timeLimit?: number;
  hintsEnabled?: boolean;
  showProgress?: boolean;
}

const MultipleChoice: React.FC<MultipleChoiceProps> = ({
  question,
  onSubmit,
  timeLimit,
  hintsEnabled = true,
  showProgress = true
}) => {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; explanation?: string } | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Reset state for new question
    setSelectedOption('');
    setIsSubmitted(false);
    setFeedback(null);
    setTimeSpent(0);
    setHintsUsed(0);
    setShowHint(false);
    setIsLoading(false);
  }, [question.id]);

  useEffect(() => {
    // Timer for tracking time spent on question
    if (isSubmitted) return;

    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 100); // Track in milliseconds
    }, 100);

    return () => clearInterval(timer);
  }, [isSubmitted]);

  const handleOptionSelect = (option: string) => {
    if (isSubmitted) return;
    setSelectedOption(option);
  };

  const handleSubmit = async () => {
    if (!selectedOption || isSubmitted) return;

    setIsLoading(true);
    setIsSubmitted(true);

    try {
      const result = await onSubmit(selectedOption, timeSpent, hintsUsed);
      setFeedback(result);
    } catch (error) {
      console.error('Failed to submit answer:', error);
      setIsSubmitted(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowHint = () => {
    if (!hintsEnabled || showHint) return;
    setShowHint(true);
    setHintsUsed(prev => prev + 1);
  };

  const getOptionStyle = (option: string) => {
    const baseStyle = {
      width: '100%',
      padding: 'var(--spacing-md)',
      margin: 'var(--spacing-xs) 0',
      border: '2px solid var(--color-border)',
      borderRadius: '8px',
      backgroundColor: 'var(--color-surface)',
      cursor: isSubmitted ? 'default' : 'pointer',
      transition: 'all 0.2s ease',
      textAlign: 'left' as const,
      fontSize: 'var(--font-size-base)',
      color: 'var(--color-text-primary)'
    };

    if (isSubmitted && feedback) {
      if (option === question.correctAnswer) {
        return {
          ...baseStyle,
          borderColor: '#10B981',
          backgroundColor: '#10B98120',
          color: '#10B981'
        };
      } else if (option === selectedOption && !feedback.isCorrect) {
        return {
          ...baseStyle,
          borderColor: '#EF4444',
          backgroundColor: '#EF444420',
          color: '#EF4444'
        };
      }
    } else if (selectedOption === option) {
      return {
        ...baseStyle,
        borderColor: 'var(--color-primary)',
        backgroundColor: 'var(--color-primary-light)'
      };
    }

    return baseStyle;
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 100);
    return `${seconds}.${ms}s`;
  };

  return (
    <div style={{
      padding: 'var(--spacing-lg)',
      backgroundColor: 'var(--color-surface-elevated)',
      borderRadius: '12px',
      border: '1px solid var(--color-border)',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      {/* Question */}
      <div style={{
        marginBottom: 'var(--spacing-xl)'
      }}>
        <h3 style={{
          margin: '0 0 var(--spacing-md) 0',
          color: 'var(--color-text-primary)',
          fontSize: '1.25rem',
          lineHeight: '1.4'
        }}>
          {question.question}
        </h3>

        {/* Context if available */}
        {question.context && (
          <div style={{
            padding: 'var(--spacing-sm)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            fontStyle: 'italic'
          }}>
            💡 {question.context}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        {question.options?.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionSelect(option)}
            style={getOptionStyle(option)}
            disabled={isSubmitted}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: `2px solid ${selectedOption === option ? 'var(--color-primary)' : 'var(--color-border)'}`,
                backgroundColor: selectedOption === option ? 'var(--color-primary)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {selectedOption === option && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'white'
                  }} />
                )}
              </div>
              <span>{option}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Hint */}
      {hintsEnabled && question.hint && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          {!showHint ? (
            <button
              onClick={handleShowHint}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px dashed var(--color-border)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)'
              }}
              disabled={isSubmitted}
            >
              💡 Show Hint
            </button>
          ) : (
            <div style={{
              padding: 'var(--spacing-sm)',
              backgroundColor: '#F59E0B20',
              borderRadius: '6px',
              border: '1px solid #F59E0B',
              fontSize: 'var(--font-size-sm)',
              color: '#F59E0B'
            }}>
              💡 Hint: {question.hint}
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      {!isSubmitted && (
        <button
          onClick={handleSubmit}
          disabled={!selectedOption || isLoading}
          style={{
            width: '100%',
            padding: 'var(--spacing-md)',
            backgroundColor: selectedOption ? 'var(--color-primary)' : 'var(--color-border)',
            color: selectedOption ? 'white' : 'var(--color-text-secondary)',
            border: 'none',
            borderRadius: '8px',
            cursor: selectedOption ? 'pointer' : 'not-allowed',
            fontSize: 'var(--font-size-base)',
            fontWeight: '600',
            transition: 'background-color 0.2s ease'
          }}
        >
          {isLoading ? 'Submitting...' : 'Submit Answer'}
        </button>
      )}

      {/* Feedback */}
      {isSubmitted && feedback && (
        <div style={{
          marginTop: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          backgroundColor: feedback.isCorrect ? '#10B98120' : '#EF444420',
          borderRadius: '8px',
          border: `1px solid ${feedback.isCorrect ? '#10B981' : '#EF4444'}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <span style={{ fontSize: '1.5rem' }}>
              {feedback.isCorrect ? '✅' : '❌'}
            </span>
            <span style={{
              fontWeight: '600',
              color: feedback.isCorrect ? '#10B981' : '#EF4444'
            }}>
              {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
            </span>
          </div>

          {feedback.explanation && (
            <p style={{
              margin: '0 0 var(--spacing-sm) 0',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              lineHeight: '1.5'
            }}>
              {feedback.explanation}
            </p>
          )}

          <div style={{
            display: 'flex',
            gap: 'var(--spacing-lg)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)'
          }}>
            <span>⏱️ Time: {formatTime(timeSpent)}</span>
            {hintsUsed > 0 && <span>💡 Hints used: {hintsUsed}</span>}
          </div>
        </div>
      )}

      {/* Time limit indicator */}
      {timeLimit && !isSubmitted && (
        <div style={{
          marginTop: 'var(--spacing-sm)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          textAlign: 'center'
        }}>
          Time limit: {timeLimit}s
        </div>
      )}
    </div>
  );
};

export default MultipleChoice;