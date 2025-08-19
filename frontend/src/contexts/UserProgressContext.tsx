import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserProgress, ProgressStats } from '../types/progress';
import { progressService } from '../services/progressService';
import { useAuth } from './AuthContext';

interface UserProgressContextType {
  progress: UserProgress | null;
  stats: ProgressStats | null;
  isLoading: boolean;
  error: string | null;
  refreshProgress: () => Promise<void>;
  recordPracticeSession: (mode: string, duration: number) => Promise<void>;
  recordWordLearned: (word: string, translation: string) => Promise<void>;
  recordChatMessage: (message: string, response: string) => Promise<void>;
  clearError: () => void;
}

const UserProgressContext = createContext<UserProgressContextType | undefined>(undefined);

interface UserProgressProviderProps {
  children: ReactNode;
}

export const UserProgressProvider: React.FC<UserProgressProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProgress = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !user) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const [progressData, statsData] = await Promise.all([
        progressService.getUserProgress(user.id),
        progressService.getProgressStats(user.id)
      ]);
      
      setProgress(progressData);
      setStats(statsData);
    } catch (error: any) {
      console.error('Failed to fetch progress:', error);
      setError(error.message || 'Failed to load progress data');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      refreshProgress();
    } else {
      setProgress(null);
      setStats(null);
    }
  }, [isAuthenticated, user, refreshProgress]);

  const recordPracticeSession = async (mode: string, duration: number): Promise<void> => {
    if (!isAuthenticated || !user) return;

    try {
      await progressService.recordPracticeSession({
        userId: user.id,
        mode,
        duration,
        timestamp: new Date()
      });
      
      // Update local state optimistically
      if (progress) {
        setProgress(prev => prev ? {
          ...prev,
          totalPracticeMinutes: prev.totalPracticeMinutes + duration,
          lastPracticeDate: new Date()
        } : null);
      }
    } catch (error: any) {
      console.error('Failed to record practice session:', error);
      setError(error.message || 'Failed to record practice session');
    }
  };

  const recordWordLearned = async (word: string, translation: string): Promise<void> => {
    if (!isAuthenticated || !user) return;

    try {
      await progressService.recordWordLearned({
        userId: user.id,
        word,
        translation,
        timestamp: new Date()
      });
      
      // Update local state optimistically
      if (progress) {
        const existingWord = progress.vocabularyMastery.find(v => v.word === word);
        if (!existingWord) {
          setProgress(prev => prev ? {
            ...prev,
            totalWordsLearned: prev.totalWordsLearned + 1,
            vocabularyMastery: [
              ...prev.vocabularyMastery,
              {
                word,
                translation,
                firstSeen: new Date(),
                lastPracticed: new Date(),
                masteryLevel: 1,
                timesCorrect: 1,
                timesIncorrect: 0
              }
            ]
          } : null);
        }
      }
    } catch (error: any) {
      console.error('Failed to record word learned:', error);
      setError(error.message || 'Failed to record word learned');
    }
  };

  const recordChatMessage = async (message: string, response: string): Promise<void> => {
    if (!isAuthenticated || !user) return;

    try {
      await progressService.recordChatMessage({
        userId: user.id,
        message,
        response,
        timestamp: new Date()
      });
      
      // Refresh progress to update streak and other metrics
      await refreshProgress();
    } catch (error: any) {
      console.error('Failed to record chat message:', error);
      setError(error.message || 'Failed to record chat message');
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  const value: UserProgressContextType = {
    progress,
    stats,
    isLoading,
    error,
    refreshProgress,
    recordPracticeSession,
    recordWordLearned,
    recordChatMessage,
    clearError,
  };

  return (
    <UserProgressContext.Provider value={value}>
      {children}
    </UserProgressContext.Provider>
  );
};

export const useProgress = (): UserProgressContextType => {
  const context = useContext(UserProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a UserProgressProvider');
  }
  return context;
};