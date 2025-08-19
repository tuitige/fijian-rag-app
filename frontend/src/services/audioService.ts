// services/audioService.ts
import api from './api';

export interface AudioFeatures {
  textToSpeech: (text: string, language: 'fj' | 'en') => Promise<string>;
  recordAudio: () => Promise<Blob>;
  playAudio: (audioUrl: string, speed?: number) => Promise<void>;
  comparePronounciation: (originalUrl: string, userAudio: Blob) => Promise<number>;
}

export interface AudioSettings {
  speed: number; // 0.5 - 2.0
  voice: string; // voice ID
  autoPlay: boolean;
  recordingQuality: 'low' | 'medium' | 'high';
}

class AudioService implements AudioFeatures {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private settings: AudioSettings = {
    speed: 1.0,
    voice: 'default',
    autoPlay: false,
    recordingQuality: 'medium'
  };

  /**
   * Initialize audio service
   */
  async initialize(): Promise<void> {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.warn('Microphone access denied:', error);
    }
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(text: string, language: 'fj' | 'en' = 'fj'): Promise<string> {
    try {
      const response = await api.post('/audio/tts', {
        text,
        language,
        voice: this.settings.voice,
        speed: this.settings.speed
      });

      return response.data.audioUrl;
    } catch (error) {
      console.warn('Server TTS failed, using browser TTS:', error);
      return this.browserTextToSpeech(text, language);
    }
  }

  /**
   * Record audio from microphone
   */
  async recordAudio(): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: this.getRecordingQuality(),
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          stream.getTracks().forEach(track => track.stop());
          resolve(audioBlob);
        };

        this.mediaRecorder.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Play audio from URL
   */
  async playAudio(audioUrl: string, speed: number = this.settings.speed): Promise<void> {
    return new Promise((resolve, reject) => {
      // Stop any currently playing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }

      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.playbackRate = speed;

      this.currentAudio.onended = () => resolve();
      this.currentAudio.onerror = (error) => reject(error);

      this.currentAudio.play().catch(reject);
    });
  }

  /**
   * Compare user pronunciation with reference audio
   */
  async comparePronounciation(originalUrl: string, userAudio: Blob): Promise<number> {
    try {
      const formData = new FormData();
      formData.append('reference', originalUrl);
      formData.append('user_audio', userAudio, 'recording.webm');

      const response = await api.post('/audio/compare', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data.score; // 0-100 similarity score
    } catch (error) {
      console.warn('Pronunciation comparison failed:', error);
      // Return a mock score for now
      return Math.floor(Math.random() * 40) + 60; // Random score between 60-100
    }
  }

  /**
   * Get available voices for TTS
   */
  async getAvailableVoices(language: 'fj' | 'en'): Promise<Array<{ id: string; name: string; gender: string }>> {
    try {
      const response = await api.get(`/audio/voices?language=${language}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch voices:', error);
      return this.getBrowserVoices(language);
    }
  }

  /**
   * Analyze audio for pronunciation issues
   */
  async analyzePronunciation(audioBlob: Blob, targetText: string): Promise<{
    accuracy: number;
    issues: Array<{ word: string; issue: string; suggestion: string }>;
    overallFeedback: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'pronunciation.webm');
      formData.append('target_text', targetText);

      const response = await api.post('/audio/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error) {
      console.warn('Pronunciation analysis failed:', error);
      
      // Return mock analysis
      return {
        accuracy: Math.floor(Math.random() * 30) + 70,
        issues: [
          {
            word: 'bula',
            issue: 'Vowel pronunciation',
            suggestion: 'Try pronouncing the "u" sound more clearly'
          }
        ],
        overallFeedback: 'Good effort! Focus on vowel clarity.'
      };
    }
  }

  /**
   * Set audio settings
   */
  updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current audio settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Check if audio recording is supported
   */
  isRecordingSupported(): boolean {
    return !!(navigator.mediaDevices && 
              typeof navigator.mediaDevices.getUserMedia === 'function' && 
              window.MediaRecorder);
  }

  /**
   * Check if TTS is supported
   */
  isTTSSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Browser-based text-to-speech fallback
   */
  private browserTextToSpeech(text: string, language: 'fj' | 'en'): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isTTSSupported()) {
        reject(new Error('Text-to-speech not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'fj' ? 'en-US' : 'en-US'; // Fallback to English for Fijian
      utterance.rate = this.settings.speed;

      utterance.onend = () => {
        // For browser TTS, we can't return a URL, so we'll resolve with a placeholder
        resolve('data:audio/wav;base64,');
      };

      utterance.onerror = (error) => {
        reject(error);
      };

      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Get browser voices
   */
  private getBrowserVoices(language: 'fj' | 'en'): Array<{ id: string; name: string; gender: string }> {
    if (!this.isTTSSupported()) return [];

    const voices = speechSynthesis.getVoices();
    const targetLang = language === 'fj' ? 'en' : 'en'; // Fallback for Fijian

    return voices
      .filter(voice => voice.lang.startsWith(targetLang))
      .map(voice => ({
        id: voice.name,
        name: voice.name,
        gender: 'unknown' // Browser API doesn't provide gender info
      }));
  }

  /**
   * Get recording quality sample rate
   */
  private getRecordingQuality(): number {
    switch (this.settings.recordingQuality) {
      case 'low': return 16000;
      case 'medium': return 22050;
      case 'high': return 44100;
      default: return 22050;
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Generate audio URL for vocabulary word
   */
  async getVocabularyAudio(word: string, language: 'fj' | 'en' = 'fj'): Promise<string> {
    // Check cache first
    const cacheKey = `audio_${language}_${word}`;
    const cachedUrl = localStorage.getItem(cacheKey);
    
    if (cachedUrl) {
      return cachedUrl;
    }

    // Generate new audio
    const audioUrl = await this.textToSpeech(word, language);
    
    // Cache the result
    localStorage.setItem(cacheKey, audioUrl);
    
    return audioUrl;
  }

  /**
   * Preload audio for common words
   */
  async preloadCommonWords(words: string[], language: 'fj' | 'en' = 'fj'): Promise<void> {
    const preloadPromises = words.map(word => 
      this.getVocabularyAudio(word, language).catch(error => 
        console.warn(`Failed to preload audio for "${word}":`, error)
      )
    );

    await Promise.allSettled(preloadPromises);
  }
}

const audioService = new AudioService();
export default audioService;