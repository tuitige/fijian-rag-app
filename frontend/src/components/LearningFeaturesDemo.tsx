import React, { useState } from 'react';
import FlashCard from './Learning/SpacedRepetition/FlashCard';
import MemoryStrengthIndicator from './Learning/SpacedRepetition/MemoryStrengthIndicator';
import ReviewScheduler from './Learning/SpacedRepetition/ReviewScheduler';
// import ExerciseContainer from './Learning/Exercises/ExerciseContainer'; // TODO: Will be used for exercise features
import MultipleChoice from './Learning/Exercises/MultipleChoice';
import PronunciationPlayer from './Learning/Audio/PronunciationPlayer';
import LearningInsights from './Learning/Analytics/LearningInsights';
import CulturalNotes from './Learning/Cultural/CulturalNotes';
import { SRSCard } from '../types/spaced-repetition';
import { ExerciseType, ExerciseQuestion } from '../types/exercises';

const LearningFeaturesDemo: React.FC = () => {
  const [currentDemo, setCurrentDemo] = useState<string>('flashcard');
  const [isFlashCardFlipped, setIsFlashCardFlipped] = useState(false);

  // Mock data
  const mockCard: SRSCard = {
    id: 'demo-1',
    front: 'Bula',
    back: 'Hello / Life / Health',
    context: 'A traditional Fijian greeting that wishes someone good health and happiness',
    interval: 7,
    repetitions: 3,
    easeFactor: 2.5,
    dueDate: new Date(),
    lastReviewed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  };

  const mockExerciseQuestion: ExerciseQuestion = {
    id: 'demo-q1',
    type: ExerciseType.MULTIPLE_CHOICE,
    question: 'What does "bula" mean in English?',
    options: ['Hello', 'Goodbye', 'Thank you', 'Please'],
    correctAnswer: 'Hello',
    hint: 'It\'s a common greeting in Fiji',
    difficulty: 2
  };

  const demoSections = [
    { id: 'flashcard', name: 'Flash Cards', icon: '🃏' },
    { id: 'memory', name: 'Memory Strength', icon: '🧠' },
    { id: 'scheduler', name: 'Review Scheduler', icon: '📅' },
    { id: 'exercise', name: 'Exercises', icon: '✏️' },
    { id: 'audio', name: 'Audio', icon: '🔊' },
    { id: 'analytics', name: 'Analytics', icon: '📊' },
    { id: 'cultural', name: 'Cultural Context', icon: '🌺' }
  ];

  const handleAnswerSubmit = async (answer: string, timeSpent: number, hintsUsed: number) => {
    console.log('Answer submitted:', { answer, timeSpent, hintsUsed });
    return {
      isCorrect: answer === 'Hello',
      explanation: answer === 'Hello' 
        ? 'Correct! "Bula" is indeed the traditional Fijian greeting meaning hello.'
        : `Not quite right. "Bula" means "Hello" in Fijian. It's much more than just a greeting - it's a way of wishing someone good health and happiness.`
    };
  };

  const renderCurrentDemo = () => {
    switch (currentDemo) {
      case 'flashcard':
        return (
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
              Interactive Flash Cards
            </h3>
            <FlashCard
              card={mockCard}
              isFlipped={isFlashCardFlipped}
              onFlip={() => setIsFlashCardFlipped(!isFlashCardFlipped)}
              showInstructions={true}
            />
            <div style={{
              textAlign: 'center',
              marginTop: 'var(--spacing-lg)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}>
              Click the card to flip it and see the translation. Audio playback is available on both sides.
            </div>
          </div>
        );

      case 'memory':
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
              Memory Strength Tracking
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-lg)',
              alignItems: 'center'
            }}>
              <MemoryStrengthIndicator card={mockCard} size="large" showDetails={true} />
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                maxWidth: '400px'
              }}>
                The memory strength indicator shows how well you remember this card based on 
                the spaced repetition algorithm. It considers factors like review history, 
                ease factor, and time since last review.
              </div>
            </div>
          </div>
        );

      case 'scheduler':
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
              Review Scheduler
            </h3>
            <ReviewScheduler
              userId="demo-user"
              onStartReview={(cards) => {
                console.log('Starting review with cards:', cards);
                alert(`Starting review session with ${cards.length} cards`);
              }}
              showUpcoming={true}
            />
          </div>
        );

      case 'exercise':
        return (
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
              Interactive Exercises
            </h3>
            <MultipleChoice
              question={mockExerciseQuestion}
              onSubmit={handleAnswerSubmit}
              hintsEnabled={true}
              showProgress={true}
            />
          </div>
        );

      case 'audio':
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
              Audio & Pronunciation
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-lg)',
              alignItems: 'center'
            }}>
              <PronunciationPlayer
                text="Bula"
                language="fj"
                showText={true}
                size="large"
              />
              <PronunciationPlayer
                text="Vinaka"
                language="fj"
                showText={true}
                size="medium"
              />
              <PronunciationPlayer
                text="Yadra"
                language="fj"
                showText={true}
                size="small"
              />
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                maxWidth: '400px'
              }}>
                Click the audio buttons to hear native pronunciation. The system supports 
                text-to-speech generation and playback speed control.
              </div>
            </div>
          </div>
        );

      case 'analytics':
        return (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
              Learning Analytics
            </h3>
            <LearningInsights
              userId="demo-user"
              limit={4}
              showRefresh={true}
            />
          </div>
        );

      case 'cultural':
        return (
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
              Cultural Context
            </h3>
            <CulturalNotes
              word="Bula"
              expanded={true}
              showCategories={true}
            />
          </div>
        );

      default:
        return <div>Select a demo from the menu above</div>;
    }
  };

  return (
    <div style={{
      padding: 'var(--spacing-lg)',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: 'var(--spacing-xl)'
      }}>
        <h1 style={{
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--spacing-md)'
        }}>
          🇫🇯 Advanced Learning Features Demo
        </h1>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-lg)',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          Explore the new advanced learning features including spaced repetition, 
          interactive exercises, audio pronunciation, and cultural context.
        </p>
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-xl)',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-surface-elevated)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)'
      }}>
        {demoSections.map(section => (
          <button
            key={section.id}
            onClick={() => setCurrentDemo(section.id)}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: currentDemo === section.id 
                ? 'var(--color-primary)' 
                : 'var(--color-surface)',
              color: currentDemo === section.id 
                ? 'white' 
                : 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{section.icon}</span>
            {section.name}
          </button>
        ))}
      </div>

      {/* Demo content */}
      <div style={{
        minHeight: '400px'
      }}>
        {renderCurrentDemo()}
      </div>
    </div>
  );
};

export default LearningFeaturesDemo;