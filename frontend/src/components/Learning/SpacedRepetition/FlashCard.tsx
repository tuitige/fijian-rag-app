import React, { useState, useEffect } from 'react';
import { SRSCard } from '../../../types/spaced-repetition';
import audioService from '../../../services/audioService';
import './FlashCard.css';

interface FlashCardProps {
  card: SRSCard;
  isFlipped: boolean;
  onFlip: () => void;
  disabled?: boolean;
  showInstructions?: boolean;
}

const FlashCard: React.FC<FlashCardProps> = ({
  card,
  isFlipped,
  onFlip,
  disabled = false,
  showInstructions = true
}) => {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const handleAudioPlay = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card flip
    
    if (isAudioPlaying) return;
    
    try {
      setIsAudioPlaying(true);
      
      if (card.audioUrl) {
        await audioService.playAudio(card.audioUrl);
      } else {
        // Generate TTS for the current side
        const text = isFlipped ? card.back : card.front;
        const language = isFlipped ? 'en' : 'fj';
        const audioUrl = await audioService.textToSpeech(text, language);
        await audioService.playAudio(audioUrl);
      }
    } catch (error) {
      console.warn('Failed to play audio:', error);
    } finally {
      setIsAudioPlaying(false);
    }
  };

  // Auto-flip back after a delay when disabled (for review flow)
  useEffect(() => {
    if (disabled && isFlipped) {
      const timer = setTimeout(() => {
        // This would be handled by parent component
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [disabled, isFlipped]);

  return (
    <div 
      className={`flash-card ${isFlipped ? 'flipped' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onFlip}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault();
          onFlip();
        }
      }}
      aria-label={`Flash card: ${isFlipped ? 'showing answer' : 'showing question'}`}
    >
      <div className="flash-card-inner">
        {/* Front side - Fijian word */}
        <div className="flash-card-front">
          <div className="flash-card-content">
            <div className="flash-card-text" aria-label="Fijian word">
              {card.front}
            </div>
            
            {card.context && !isFlipped && (
              <div className="flash-card-context">
                {card.context}
              </div>
            )}
            
            <div className="flash-card-audio">
              <button
                className="audio-button"
                onClick={handleAudioPlay}
                disabled={isAudioPlaying}
                aria-label="Play pronunciation"
                title="Play pronunciation"
              >
                {isAudioPlaying ? '⏸️' : '🔊'}
              </button>
            </div>
          </div>
          
          {showInstructions && !isFlipped && (
            <div className="flash-card-instructions">
              Tap to see translation
            </div>
          )}
        </div>

        {/* Back side - English translation */}
        <div className="flash-card-back">
          <div className="flash-card-content">
            <div className="flash-card-text" aria-label="English translation">
              {card.back}
            </div>
            
            {card.context && isFlipped && (
              <div className="flash-card-context">
                {card.context}
              </div>
            )}
            
            <div className="flash-card-audio">
              <button
                className="audio-button"
                onClick={handleAudioPlay}
                disabled={isAudioPlaying}
                aria-label="Play pronunciation"
                title="Play pronunciation"
              >
                {isAudioPlaying ? '⏸️' : '🔊'}
              </button>
            </div>
          </div>
          
          {showInstructions && isFlipped && (
            <div className="flash-card-instructions">
              How well did you remember?
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashCard;