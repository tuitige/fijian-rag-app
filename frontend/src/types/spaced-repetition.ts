// types/spaced-repetition.ts
export interface SRSCard {
  id: string;
  front: string; // Fijian word/phrase
  back: string; // English translation
  context?: string;
  audioUrl?: string;
  interval: number; // days until next review
  repetitions: number;
  easeFactor: number;
  dueDate: Date;
  lastReviewed?: Date;
}

export interface ReviewSession {
  cards: SRSCard[];
  sessionStart: Date;
  cardsReviewed: number;
  accuracy: number;
}

// Algorithm based on SM-2
export enum ReviewQuality {
  AGAIN = 0,    // Complete blackout
  HARD = 3,     // Recalled with serious difficulty
  GOOD = 4,     // Recalled with some difficulty
  EASY = 5      // Recalled perfectly
}

export interface MemoryStrength {
  cardId: string;
  strength: number; // 0-100
  confidence: number; // 0-100
  lastCalculated: Date;
}

export interface ScheduleResult {
  card: SRSCard;
  nextReviewDate: Date;
  intervalDays: number;
}