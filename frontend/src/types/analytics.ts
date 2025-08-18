// types/analytics.ts
import { ExerciseType } from './exercises';

export interface LearningInsight {
  type: 'strength' | 'weakness' | 'trend' | 'recommendation';
  title: string;
  description: string;
  metric: number;
  unit: string;
  change?: number; // percentage change
  icon: string;
}

export interface ProgressHeatmap {
  date: string; // YYYY-MM-DD
  value: number; // 0-100 (practice intensity)
  sessions: number;
  wordsLearned: number;
}

export interface SkillLevel {
  skill: string;
  level: number; // 0-100
  breakdown: {
    vocabulary: number;
    grammar: number;
    listening: number;
    speaking: number;
    reading: number;
    writing: number;
  };
}

export interface FluencyPrediction {
  currentLevel: number; // 0-100
  predictedLevel: number; // 0-100
  timeToGoal: number; // days
  confidence: number; // 0-100
  factors: {
    studyFrequency: number;
    sessionQuality: number;
    retentionRate: number;
    difficultyProgression: number;
  };
}

export interface LearningPattern {
  bestStudyTime: string; // HH:MM format
  averageSessionLength: number; // minutes
  preferredExerciseTypes: ExerciseType[];
  peakPerformanceDays: string[]; // day names
  strugglingAreas: string[];
}

export interface StudyStreak {
  current: number;
  longest: number;
  streakMultiplier: number; // bonus multiplier for streak
  lastPracticeDate: Date;
  nextGoal: number;
}

export interface WeeklyReport {
  weekStart: Date;
  totalMinutes: number;
  wordsLearned: number;
  exercisesCompleted: number;
  averageAccuracy: number;
  improvementAreas: string[];
  achievements: string[];
}