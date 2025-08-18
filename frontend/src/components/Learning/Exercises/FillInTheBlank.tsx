import React, { useState, useEffect } from 'react';
import { ExerciseQuestion } from '../../../types/exercises';

interface FillInTheBlankProps {
  question: ExerciseQuestion;
  onSubmit: (answer: string, timeSpent: number, hintsUsed: number) => Promise<{ isCorrect: boolean; explanation?: string }>;
  timeLimit?: number;
  hintsEnabled?: boolean;
  showProgress?: boolean;
}

const FillInTheBlank: React.FC<FillInTheBlankProps> = ({
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
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Reset state for new question
    setUserAnswer('');
    setIsSubmitted(false);
    setFeedback(null);
    setTimeSpent(0);
    setHintsUsed(0);
    setShowHint(false);
    setIsLoading(false);
    setSuggestions([]);
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
    // Generate suggestions as user types
    if (userAnswer.length >= 2 && !isSubmitted) {
      generateSuggestions(userAnswer);
    } else {
      setSuggestions([]);
    }
  }, [userAnswer, isSubmitted]);

  const generateSuggestions = (input: string) => {
    // Mock auto-complete suggestions - in real app, this would call an API
    const possibleWords = [
      'sa', 'vinaka', 'bula', 'yadra', 'moce', 'io', 'sega', 'vaka', 'tiko', 'lako',
      'kana', 'gunu', 'rawa', 'cake', 'yani', 'vakarau', 'levu', 'lailai'
    ];

    const filtered = possibleWords
      .filter(word => word.toLowerCase().startsWith(input.toLowerCase()))
      .slice(0, 5);

    setSuggestions(filtered);
  };

  const handleInputChange = (value: string) => {
    if (isSubmitted) return;
    setUserAnswer(value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setUserAnswer(suggestion);
    setSuggestions([]);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleShowHint = () => {
    if (!hintsEnabled || showHint) return;
    setShowHint(true);
    setHintsUsed(prev => prev + 1);
  };

  // Parse question text to identify blanks
  const renderQuestionWithBlanks = () => {
    const text = question.question;
    const blankPattern = /_+/g;
    
    if (!blankPattern.test(text)) {
      // No underscores found, treat as simple fill-in-the-blank at the end
      return (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
          <span>{text}</span>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSubmitted}
              placeholder="Type your answer..."
              style={{
                padding: 'var(--spacing-sm)',
                border: `2px solid ${isSubmitted && feedback ? 
                  (feedback.isCorrect ? '#10B981' : '#EF4444') : 
                  'var(--color-border)'}`,
                borderRadius: '6px',
                fontSize: 'inherit',
                backgroundColor: isSubmitted ? 
                  (feedback?.isCorrect ? '#10B98120' : '#EF444420') : 
                  'var(--color-surface)',
                minWidth: '120px',
                outline: 'none'
              }}
            />
            {renderSuggestions()}
          </div>
        </div>
      );
    }

    // Split text by blanks and render with input fields
    const parts = text.split(blankPattern);
    const elements = [];

    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        elements.push(
          <span key={`text-${i}`}>{parts[i]}</span>
        );
      }
      
      if (i < parts.length - 1) {
        elements.push(
          <div key={`input-${i}`} style={{ position: 'relative', display: 'inline-block' }}>
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSubmitted}
              placeholder="?"
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: `2px solid ${isSubmitted && feedback ? 
                  (feedback.isCorrect ? '#10B981' : '#EF4444') : 
                  'var(--color-border)'}`,
                borderRadius: '4px',
                fontSize: 'inherit',
                backgroundColor: isSubmitted ? 
                  (feedback?.isCorrect ? '#10B98120' : '#EF444420') : 
                  'var(--color-surface)',
                minWidth: '80px',
                textAlign: 'center',
                outline: 'none'
              }}
            />
            {i === 0 && renderSuggestions()}
          </div>
        );
      }
    }

    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 'var(--spacing-xs)',
        lineHeight: '2'
      }}>
        {elements}
      </div>
    );
  };

  const renderSuggestions = () => {
    if (suggestions.length === 0 || isSubmitted) return null;

    return (
      <div style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        marginTop: '2px'
      }}>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(suggestion)}
            style={{
              width: '100%',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: 'none',
              backgroundColor: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              borderBottom: index < suggestions.length - 1 ? '1px solid var(--color-border)' : 'none'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    );
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
        marginBottom: 'var(--spacing-xl)',
        fontSize: '1.25rem',
        lineHeight: '1.6',
        color: 'var(--color-text-primary)'
      }}>
        {renderQuestionWithBlanks()}
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
          💡 {question.context}
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
            <span>📝 Your answer: "{userAnswer}"</span>
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

export default FillInTheBlank;