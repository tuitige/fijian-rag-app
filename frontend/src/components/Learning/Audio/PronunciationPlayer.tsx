import React, { useState, useRef, useEffect } from 'react';
import audioService from '../../../services/audioService';

interface PronunciationPlayerProps {
  text: string;
  language?: 'fj' | 'en';
  audioUrl?: string;
  showText?: boolean;
  autoPlay?: boolean;
  speed?: number;
  size?: 'small' | 'medium' | 'large';
}

const PronunciationPlayer: React.FC<PronunciationPlayerProps> = ({
  text,
  language = 'fj',
  audioUrl,
  showText = true,
  autoPlay = false,
  speed = 1.0,
  size = 'medium'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(audioUrl || null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (autoPlay && currentAudioUrl) {
      handlePlay();
    }
  }, [autoPlay, currentAudioUrl]);

  useEffect(() => {
    // Clean up audio when component unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const generateAudioUrl = async (): Promise<string> => {
    if (currentAudioUrl) return currentAudioUrl;
    
    try {
      const url = await audioService.textToSpeech(text, language);
      setCurrentAudioUrl(url);
      return url;
    } catch (error) {
      throw new Error('Failed to generate audio');
    }
  };

  const handlePlay = async () => {
    if (isPlaying) {
      handleStop();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const url = await generateAudioUrl();
      
      if (audioRef.current) {
        audioRef.current.pause();
      }

      audioRef.current = new Audio(url);
      audioRef.current.playbackRate = speed;
      
      audioRef.current.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };

      audioRef.current.onended = () => {
        setIsPlaying(false);
      };

      audioRef.current.onerror = () => {
        setError('Failed to play audio');
        setIsPlaying(false);
        setIsLoading(false);
      };

      await audioRef.current.play();
    } catch (error) {
      console.error('Audio playback failed:', error);
      setError('Audio playback failed');
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return {
          buttonSize: '32px',
          fontSize: '0.875rem',
          iconSize: '14px',
          padding: 'var(--spacing-xs)'
        };
      case 'large':
        return {
          buttonSize: '56px',
          fontSize: '1.125rem',
          iconSize: '24px',
          padding: 'var(--spacing-md)'
        };
      default: // medium
        return {
          buttonSize: '44px',
          fontSize: '1rem',
          iconSize: '18px',
          padding: 'var(--spacing-sm)'
        };
    }
  };

  const config = getSizeConfig();

  const getButtonIcon = () => {
    if (isLoading) return '⏳';
    if (error) return '❌';
    if (isPlaying) return '⏸️';
    return '🔊';
  };

  const getButtonTitle = () => {
    if (isLoading) return 'Loading audio...';
    if (error) return error;
    if (isPlaying) return 'Stop audio';
    return `Play pronunciation of "${text}"`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--spacing-sm)',
      padding: config.padding
    }}>
      <button
        onClick={handlePlay}
        disabled={isLoading || !!error}
        title={getButtonTitle()}
        style={{
          width: config.buttonSize,
          height: config.buttonSize,
          borderRadius: '50%',
          border: `2px solid ${error ? '#EF4444' : 'var(--color-primary)'}`,
          backgroundColor: isPlaying ? 'var(--color-primary)' : 'transparent',
          color: isPlaying ? 'white' : (error ? '#EF4444' : 'var(--color-primary)'),
          cursor: isLoading || error ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: config.iconSize,
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
        onMouseOver={(e) => {
          if (!isLoading && !error) {
            e.currentTarget.style.transform = 'scale(1.05)';
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary-light)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {getButtonIcon()}
      </button>

      {showText && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <span style={{
            fontSize: config.fontSize,
            fontWeight: '600',
            color: 'var(--color-text-primary)'
          }}>
            {text}
          </span>
          
          {language === 'fj' && (
            <span style={{
              fontSize: 'calc(' + config.fontSize + ' * 0.85)',
              color: 'var(--color-text-secondary)',
              fontStyle: 'italic'
            }}>
              Fijian
            </span>
          )}
        </div>
      )}

      {/* Speed control for large size */}
      {size === 'large' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          marginLeft: 'var(--spacing-sm)'
        }}>
          <span style={{
            fontSize: 'calc(' + config.fontSize + ' * 0.75)',
            color: 'var(--color-text-secondary)'
          }}>
            Speed:
          </span>
          <select
            value={speed}
            onChange={(e) => {
              const newSpeed = parseFloat(e.target.value);
              audioService.updateSettings({ speed: newSpeed });
              if (audioRef.current) {
                audioRef.current.playbackRate = newSpeed;
              }
            }}
            style={{
              fontSize: 'calc(' + config.fontSize + ' * 0.75)',
              padding: '2px 4px',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--color-surface)'
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2.0}>2x</option>
          </select>
        </div>
      )}

      {/* Error message */}
      {error && (
        <span style={{
          fontSize: 'calc(' + config.fontSize + ' * 0.75)',
          color: '#EF4444',
          fontStyle: 'italic'
        }}>
          {error}
        </span>
      )}
    </div>
  );
};

export default PronunciationPlayer;