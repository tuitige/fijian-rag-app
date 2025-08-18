// types/exercises.ts
export enum ExerciseType {
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_IN_BLANK = 'fill_in_blank',
  TRANSLATION = 'translation',
  LISTENING = 'listening',
  SENTENCE_BUILDER = 'sentence_builder'
}

export interface ExerciseQuestion {
  id: string;
  type: ExerciseType;
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer: string | string[]; // Can be multiple for sentence builder
  hint?: string;
  audioUrl?: string;
  context?: string;
  difficulty: number; // 1-5
}

export interface ExerciseSession {
  id: string;
  userId: string;
  type: ExerciseType;
  questions: ExerciseQuestion[];
  currentQuestionIndex: number;
  score: number;
  totalQuestions: number;
  startTime: Date;
  endTime?: Date;
  responses: ExerciseResponse[];
}

export interface ExerciseResponse {
  questionId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  timeSpent: number; // milliseconds
  hintsUsed: number;
  timestamp: Date;
}

export interface ExerciseResult {
  session: ExerciseSession;
  accuracy: number;
  averageTime: number;
  difficultyProgression: number; // -1 to 1 (decrease to increase)
  strengthAreas: string[];
  weaknessAreas: string[];
}

export interface ExerciseSettings {
  difficultyLevel: number; // 1-5
  timeLimit?: number; // seconds per question
  hintsEnabled: boolean;
  audioSpeed: number; // 0.5 - 2.0
  showProgress: boolean;
}