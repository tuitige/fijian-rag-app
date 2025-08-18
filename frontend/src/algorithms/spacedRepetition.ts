// algorithms/spacedRepetition.ts
import { SRSCard, ReviewQuality, ScheduleResult } from '../types/spaced-repetition';

/**
 * SM-2 Algorithm implementation for spaced repetition
 * Based on the SuperMemo algorithm by Piotr Wozniak
 */
export class SpacedRepetitionAlgorithm {
  private static readonly MIN_EASE_FACTOR = 1.3;
  private static readonly INITIAL_EASE_FACTOR = 2.5;
  private static readonly INITIAL_INTERVAL = 1;

  /**
   * Calculate the next review schedule for a card based on review quality
   */
  static scheduleNextReview(card: SRSCard, quality: ReviewQuality): ScheduleResult {
    let interval = card.interval;
    let repetitions = card.repetitions;
    let easeFactor = card.easeFactor;

    if (quality >= ReviewQuality.HARD) {
      // Correct response
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    } else {
      // Incorrect response - reset repetitions but keep ease factor
      repetitions = 0;
      interval = this.INITIAL_INTERVAL;
    }

    // Update ease factor based on quality
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(easeFactor, this.MIN_EASE_FACTOR);

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    const updatedCard: SRSCard = {
      ...card,
      interval,
      repetitions,
      easeFactor,
      dueDate: nextReviewDate,
      lastReviewed: new Date()
    };

    return {
      card: updatedCard,
      nextReviewDate,
      intervalDays: interval
    };
  }

  /**
   * Create a new SRS card with default values
   */
  static createCard(
    id: string,
    front: string,
    back: string,
    context?: string,
    audioUrl?: string
  ): SRSCard {
    return {
      id,
      front,
      back,
      context,
      audioUrl,
      interval: this.INITIAL_INTERVAL,
      repetitions: 0,
      easeFactor: this.INITIAL_EASE_FACTOR,
      dueDate: new Date(), // Due immediately for first review
      lastReviewed: undefined
    };
  }

  /**
   * Get cards that are due for review
   */
  static getDueCards(cards: SRSCard[]): SRSCard[] {
    const now = new Date();
    return cards.filter(card => card.dueDate <= now);
  }

  /**
   * Calculate memory strength based on interval and ease factor
   */
  static calculateMemoryStrength(card: SRSCard): number {
    if (!card.lastReviewed) return 0;

    const daysSinceReview = Math.floor(
      (Date.now() - card.lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const strength = Math.max(0, 100 - (daysSinceReview / card.interval) * 100);
    return Math.min(100, strength);
  }

  /**
   * Predict the optimal review time for maximum retention
   */
  static getOptimalReviewTime(card: SRSCard): Date {
    // Optimal review is typically at 80% memory strength
    const optimalStrengthThreshold = 80;
    const currentStrength = this.calculateMemoryStrength(card);
    
    if (currentStrength <= optimalStrengthThreshold) {
      return new Date(); // Review now
    }

    // Calculate when strength will drop to optimal level
    const daysToOptimal = ((currentStrength - optimalStrengthThreshold) / 100) * card.interval;
    const optimalDate = new Date();
    optimalDate.setDate(optimalDate.getDate() + daysToOptimal);
    
    return optimalDate;
  }

  /**
   * Batch update multiple cards after a review session
   */
  static batchUpdateCards(
    cards: SRSCard[],
    responses: { cardId: string; quality: ReviewQuality }[]
  ): SRSCard[] {
    const responseMap = new Map(responses.map(r => [r.cardId, r.quality]));
    
    return cards.map(card => {
      const quality = responseMap.get(card.id);
      if (quality !== undefined) {
        return this.scheduleNextReview(card, quality).card;
      }
      return card;
    });
  }
}