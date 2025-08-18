import React, { useState, useEffect } from 'react';
import { ExerciseSession, ExerciseResult, ExerciseSettings, ExerciseType } from '../../../types/exercises';
import exerciseService from '../../../services/exerciseService';
import MultipleChoice from './MultipleChoice';
import FillInTheBlank from './FillInTheBlank';
import TranslationExercise from './TranslationExercise';
// import ListeningExercise from './ListeningExercise';
// import SentenceBuilder from './SentenceBuilder';

interface ExerciseContainerProps {
  userId: string;
  exerciseType: ExerciseType;
  settings: ExerciseSettings;
  onComplete: (result: ExerciseResult) => void;
  onExit: () => void;
}

const ExerciseContainer: React.FC<ExerciseContainerProps> = ({
  userId,
  exerciseType,
  settings,
  onComplete,
  onExit
}) => {
  const [session, setSession] = useState<ExerciseSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    initializeSession();
  }, [userId, exerciseType, settings]);

  useEffect(() => {
    // Timer for tracking session time
    if (!session || isPaused) return;

    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [session, isPaused]);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      const newSession = await exerciseService.startExerciseSession(
        userId,
        exerciseType,
        settings,
        settings.difficultyLevel * 2 + 6 // 8-16 questions based on difficulty
      );
      setSession(newSession);
      setTimeElapsed(0);
    } catch (error) {
      console.error('Failed to start exercise session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit = async (answer: string | string[], timeSpent: number, hintsUsed: number = 0): Promise<{ isCorrect: boolean; explanation?: string }> => {
    if (!session) throw new Error('No active session');

    try {
      const result = await exerciseService.submitAnswer(answer, timeSpent, hintsUsed);
      
      // Check if session is complete
      if (!result.nextQuestion) {
        const finalResult = await exerciseService.completeSession();
        onComplete(finalResult);
      }
      
      return {
        isCorrect: result.isCorrect,
        explanation: result.explanation
      };
    } catch (error) {
      console.error('Failed to submit answer:', error);
      throw error;
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleExit = () => {
    if (session) {
      exerciseService.abandonSession();
    }
    onExit();
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    if (!session) return 0;
    return Math.round((session.currentQuestionIndex / session.totalQuestions) * 100);
  };

  const renderExerciseComponent = () => {
    if (!session) return null;

    const currentQuestion = session.questions[session.currentQuestionIndex];
    if (!currentQuestion) return null;

    const commonProps = {
      question: currentQuestion,
      onSubmit: handleAnswerSubmit,
      timeLimit: settings.timeLimit,
      hintsEnabled: settings.hintsEnabled,
      showProgress: settings.showProgress
    };

    switch (exerciseType) {
      case ExerciseType.MULTIPLE_CHOICE:
        return <MultipleChoice {...commonProps} />;
      case ExerciseType.FILL_IN_BLANK:
        return <FillInTheBlank {...commonProps} />;
      case ExerciseType.TRANSLATION:
        return <TranslationExercise {...commonProps} />;
      // case ExerciseType.LISTENING:
      //   return <ListeningExercise {...commonProps} />;
      // case ExerciseType.SENTENCE_BUILDER:
      //   return <SentenceBuilder {...commonProps} />;
      default:
        return (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p>Exercise type "{exerciseType}" is not yet implemented.</p>
            <button onClick={handleExit} style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              backgroundColor: 'var(--color-secondary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              Go Back
            </button>
          </div>
        );
    }
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
          width: '48px',
          height: '48px',
          border: '4px solid var(--color-border)',
          borderTop: '4px solid var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p>Preparing your exercise...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 'var(--spacing-xl)',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)'
      }}>
        <h3>Failed to load exercise</h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
          We couldn't prepare your exercise. Please try again.
        </p>
        <button
          onClick={handleExit}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            backgroundColor: 'var(--color-secondary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: 'var(--spacing-lg)'
    }}>
      {/* Header with progress and controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-surface-elevated)',
        borderRadius: '8px',
        border: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>
            {exerciseType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)'
          }}>
            <span>Question {session.currentQuestionIndex + 1} of {session.totalQuestions}</span>
            <span>•</span>
            <span>{formatTime(timeElapsed)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button
            onClick={handlePause}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)'
            }}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
          <button
            onClick={handleExit}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)'
            }}
            title="Exit exercise"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {settings.showProgress && (
        <div style={{
          marginBottom: 'var(--spacing-lg)',
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
      )}

      {/* Exercise content */}
      {isPaused ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-xl)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '12px',
          border: '1px solid var(--color-border)'
        }}>
          <h3>⏸️ Exercise Paused</h3>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
            Take your time! Click resume when you're ready to continue.
          </p>
          <button
            onClick={handlePause}
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
            Resume Exercise
          </button>
        </div>
      ) : (
        renderExerciseComponent()
      )}
    </div>
  );
};

export default ExerciseContainer;