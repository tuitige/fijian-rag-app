import api from './api';
import { UserProgress, ProgressStats, VocabularyItem, Achievement } from '../types/progress';

interface PracticeSessionData {
  userId: string;
  mode: string;
  duration: number;
  timestamp: Date;
}

interface WordLearnedData {
  userId: string;
  word: string;
  translation: string;
  timestamp: Date;
}

interface ChatMessageData {
  userId: string;
  message: string;
  response: string;
  timestamp: Date;
}

class ProgressService {
  async getUserProgress(userId: string): Promise<UserProgress> {
    const response = await api.get(`/progress/dashboard?userId=${userId}`);
    return response.data;
  }

  async getProgressStats(userId: string): Promise<ProgressStats> {
    const response = await api.get(`/progress/stats?userId=${userId}`);
    return response.data;
  }

  async getVocabulary(userId: string): Promise<VocabularyItem[]> {
    const response = await api.get(`/progress/vocabulary?userId=${userId}`);
    return response.data;
  }

  async getAchievements(userId: string): Promise<Achievement[]> {
    const response = await api.get(`/progress/achievements?userId=${userId}`);
    return response.data;
  }

  async getStreak(userId: string): Promise<{ current: number; longest: number }> {
    const response = await api.get(`/progress/streak?userId=${userId}`);
    return response.data;
  }

  async recordPracticeSession(data: PracticeSessionData): Promise<void> {
    await api.post('/progress/practice-session', data);
  }

  async recordWordLearned(data: WordLearnedData): Promise<void> {
    await api.post('/progress/word-learned', data);
  }

  async recordChatMessage(data: ChatMessageData): Promise<void> {
    await api.post('/progress/chat-message', data);
  }

  async practiceWord(userId: string, wordId: string, correct: boolean): Promise<void> {
    await api.post(`/progress/vocabulary/${wordId}/practice`, {
      userId,
      correct,
      timestamp: new Date()
    });
  }

  async freezeStreak(userId: string): Promise<void> {
    await api.post('/progress/streak/freeze', { userId });
  }

  async exportProgress(userId: string): Promise<Blob> {
    const response = await api.get(`/progress/export?userId=${userId}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async deleteProgress(userId: string): Promise<void> {
    await api.delete(`/progress?userId=${userId}`);
  }

  // Helper methods for local calculations
  calculateFluencyLevel(vocabulary: VocabularyItem[]): number {
    if (vocabulary.length === 0) return 0;
    
    const totalMastery = vocabulary.reduce((sum, item) => sum + item.masteryLevel, 0);
    const maxPossibleMastery = vocabulary.length * 5; // Max mastery level is 5
    
    return Math.round((totalMastery / maxPossibleMastery) * 100);
  }

  calculateStreakFromHistory(practiceHistory: Date[]): number {
    if (practiceHistory.length === 0) return 0;
    
    const sortedDates = practiceHistory
      .map(date => new Date(date))
      .sort((a, b) => b.getTime() - a.getTime());
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedDates.length; i++) {
      const practiceDate = new Date(sortedDates[i]);
      practiceDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today.getTime() - practiceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak || (streak === 0 && daysDiff <= 1)) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  checkAchievements(progress: UserProgress): Achievement[] {
    const unlockedAchievements: Achievement[] = [];
    
    // First word achievement
    if (progress.totalWordsLearned >= 1 && !progress.achievements.find(a => a.id === 'first_word')) {
      unlockedAchievements.push({
        id: 'first_word',
        name: 'First Steps',
        description: 'Learn your first word',
        icon: '👶',
        unlockedAt: new Date(),
        progress: 100
      });
    }
    
    // Week streak achievement
    if (progress.currentStreak >= 7 && !progress.achievements.find(a => a.id === 'week_streak')) {
      unlockedAchievements.push({
        id: 'week_streak',
        name: 'Dedicated Learner',
        description: '7-day streak',
        icon: '🔥',
        unlockedAt: new Date(),
        progress: 100
      });
    }
    
    // 100 words achievement
    if (progress.totalWordsLearned >= 100 && !progress.achievements.find(a => a.id === 'vocabulary_100')) {
      unlockedAchievements.push({
        id: 'vocabulary_100',
        name: 'Word Collector',
        description: 'Learn 100 words',
        icon: '📚',
        unlockedAt: new Date(),
        progress: 100
      });
    }
    
    // Fluency achievement
    if (progress.fluencyLevel >= 50 && !progress.achievements.find(a => a.id === 'fluency_intermediate')) {
      unlockedAchievements.push({
        id: 'fluency_intermediate',
        name: 'Getting Fluent',
        description: 'Reach 50% fluency',
        icon: '🎓',
        unlockedAt: new Date(),
        progress: 100
      });
    }
    
    return unlockedAchievements;
  }
}

export const progressService = new ProgressService();