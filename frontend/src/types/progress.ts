// types/progress.ts
export interface UserProgress {
  userId: string;
  totalWordsLearned: number;
  totalPracticeMinutes: number;
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: Date;
  fluencyLevel: number; // 0-100
  achievements: Achievement[];
  vocabularyMastery: VocabularyItem[];
}

export interface VocabularyItem {
  word: string;
  translation: string;
  firstSeen: Date;
  lastPracticed: Date;
  masteryLevel: number; // 0-5
  timesCorrect: number;
  timesIncorrect: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  progress: number; // 0-100
}

export interface PracticeSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  mode: string;
  wordsLearned: string[];
  messagesExchanged: number;
  accuracy?: number;
}

export interface ProgressStats {
  daily: {
    practiceMinutes: number;
    wordsLearned: number;
    messagesCount: number;
  };
  weekly: {
    practiceMinutes: number;
    wordsLearned: number;
    messagesCount: number;
  };
  monthly: {
    practiceMinutes: number;
    wordsLearned: number;
    messagesCount: number;
  };
  allTime: {
    practiceMinutes: number;
    wordsLearned: number;
    messagesCount: number;
  };
}

export const ACHIEVEMENTS = [
  { id: 'first_word', name: 'First Steps', description: 'Learn your first word', icon: '👶' },
  { id: 'week_streak', name: 'Dedicated Learner', description: '7-day streak', icon: '🔥' },
  { id: 'translator_pro', name: 'Translation Master', description: '100 translations', icon: '📝' },
  { id: 'conversation_milestone', name: 'Conversationalist', description: '50 conversations', icon: '💬' },
  { id: 'vocabulary_100', name: 'Word Collector', description: 'Learn 100 words', icon: '📚' },
  { id: 'fluency_intermediate', name: 'Getting Fluent', description: 'Reach 50% fluency', icon: '🎓' }
] as const;