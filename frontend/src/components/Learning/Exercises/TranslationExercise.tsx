import React, { useState, useEffect } from 'react';
import { ExerciseQuestion } from '../../../types/exercises';

interface TranslationExerciseProps {
  question: ExerciseQuestion;
  onSubmit: (answer: string, timeSpent: number, hintsUsed: number) => Promise<{ isCorrect: boolean; explanation?: string }>;
  timeLimit?: number;
  hintsEnabled?: boolean;
  showProgress?: boolean;
}

const TranslationExercise: React.FC<TranslationExerciseProps> = ({
  question,
  onSubmit,
  timeLimit,
  hintsEnabled = true,
  showProgress = true
}) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; explanation?: string } | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    // Reset state for new question
    setUserAnswer('');
    setIsSubmitted(false);
    setFeedback(null);
    setTimeSpent(0);
    setHintsUsed(0);
    setShowHint(false);
    setIsLoading(false);
    setWordCount(0);
  }, [question.id]);

  useEffect(() => {
    // Timer for tracking time spent on question
    if (isSubmitted) return;

    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 100);
    }, 100);

    return () => clearInterval(timer);
  }, [isSubmitted]);

  useEffect(() => {
    // Update word count
    const words = userAnswer.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [userAnswer]);

  const handleInputChange = (value: string) => {
    if (isSubmitted) return;
    setUserAnswer(value);
  };

  const handleSubmit = async () => {
    if (!userAnswer.trim() || isSubmitted) return;

    setIsLoading(true);
    setIsSubmitted(true);

    try {
      const result = await onSubmit(userAnswer.trim(), timeSpent, hintsUsed);
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

  const detectTranslationDirection = (): 'fj-to-en' | 'en-to-fj' => {
    // Simple heuristic: if question contains common Fijian words, it's Fijian to English
    const fijianWords = ['bula', 'vinaka', 'yadra', 'moce', 'sa', 'tiko', 'vaka', 'levu', 'lailai'];
    const questionLower = question.question.toLowerCase();
    
    const hasFijianWords = fijianWords.some(word => questionLower.includes(word));
    return hasFijianWords ? 'fj-to-en' : 'en-to-fj';
  };

  const getPlaceholderText = (): string => {
    const direction = detectTranslationDirection();
    return direction === 'fj-to-en' 
      ? 'Type your English translation...'
      : 'Type your Fijian translation...';
  };

  const getInstructions = (): string => {
    const direction = detectTranslationDirection();
    return direction === 'fj-to-en'
      ? 'Translate this Fijian text to English:'
      : 'Translate this English text to Fijian:';
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
      maxWidth: '700px',
      margin: '0 auto'
    }}>
      {/* Instructions */}
      <div style={{
        marginBottom: 'var(--spacing-md)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        fontWeight: '500'
      }}>
        {getInstructions()}
      </div>

      {/* Source text */}
      <div style={{
        padding: 'var(--spacing-lg)',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        marginBottom: 'var(--spacing-xl)',
        fontSize: '1.25rem',
        lineHeight: '1.6',
        color: 'var(--color-text-primary)',
        textAlign: 'center'
      }}>
        "{question.question}"
      </div>

      {/* Translation input */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <label style={{
          display: 'block',
          marginBottom: 'var(--spacing-sm)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: '500',
          color: 'var(--color-text-primary)'
        }}>
          Your translation:
        </label>
        
        <textarea
          value={userAnswer}
          onChange={(e) => handleInputChange(e.target.value)}
          disabled={isSubmitted}
          placeholder={getPlaceholderText()}
          rows={4}
          style={{
            width: '100%',
            padding: 'var(--spacing-md)',
            border: `2px solid ${isSubmitted && feedback ? 
              (feedback.isCorrect ? '#10B981' : '#EF4444') : 
              'var(--color-border)'}`,
            borderRadius: '8px',
            fontSize: 'var(--font-size-base)',
            backgroundColor: isSubmitted ? 
              (feedback?.isCorrect ? '#10B98120' : '#EF444420') : 
              'var(--color-surface)',
            resize: 'vertical' as const,
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.5'
          }}
        />
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--spacing-xs)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)'
        }}>
          <span>Words: {wordCount}</span>
          {timeLimit && !isSubmitted && (
            <span>Time limit: {timeLimit}s</span>
          )}
        </div>
      </div>

      {/* Context if available */}
      {question.context && (
        <div style={{
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-sm)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '6px',
          border: '1px solid var(--color-border)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          fontStyle: 'italic'
        }}>
          💡 Context: {question.context}
        </div>
      )}

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
          disabled={!userAnswer.trim() || isLoading}
          style={{
            width: '100%',
            padding: 'var(--spacing-md)',
            backgroundColor: userAnswer.trim() ? 'var(--color-primary)' : 'var(--color-border)',
            color: userAnswer.trim() ? 'white' : 'var(--color-text-secondary)',
            border: 'none',
            borderRadius: '8px',
            cursor: userAnswer.trim() ? 'pointer' : 'not-allowed',
            fontSize: 'var(--font-size-base)',
            fontWeight: '600',
            transition: 'background-color 0.2s ease'
          }}
        >
          {isLoading ? 'Submitting...' : 'Submit Translation'}
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
              {feedback.isCorrect ? 'Excellent translation!' : 'Not quite right'}
            </span>
          </div>

          {feedback.explanation && (
            <div style={{
              margin: '0 0 var(--spacing-sm) 0',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              lineHeight: '1.5'
            }}>
              {feedback.explanation}
            </div>
          )}

          {/* Show correct answer if incorrect */}
          {!feedback.isCorrect && (
            <div style={{
              marginBottom: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm)',
              backgroundColor: '#10B98120',
              borderRadius: '6px',
              border: '1px solid #10B981'
            }}>
              <div style={{
                fontWeight: '600',
                color: '#10B981',
                marginBottom: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)'
              }}>
                Correct translation:
              </div>
              <div style={{
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontStyle: 'italic'
              }}>
                "{question.correctAnswer}"
              </div>
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: 'var(--spacing-lg)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            flexWrap: 'wrap'
          }}>
            <span>⏱️ Time: {formatTime(timeSpent)}</span>
            {hintsUsed > 0 && <span>💡 Hints used: {hintsUsed}</span>}
            <span>📝 Words: {wordCount}</span>
          </div>
        </div>
      )}

      {/* Tips for better translations */}
      {isSubmitted && !isLoading && (
        <div style={{
          marginTop: 'var(--spacing-md)',
          padding: 'var(--spacing-sm)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '6px',
          border: '1px solid var(--color-border)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)'
        }}>
          <strong>💡 Translation tip:</strong> Try to capture the meaning rather than word-for-word translation. 
          Consider cultural context and common expressions.
        </div>
      )}
    </div>
  );
};

export default TranslationExercise;