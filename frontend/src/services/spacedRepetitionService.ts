// services/spacedRepetitionService.ts
import api from './api';
import { SRSCard, ReviewSession, ReviewQuality, MemoryStrength } from '../types/spaced-repetition';
import { SpacedRepetitionAlgorithm } from '../algorithms/spacedRepetition';

class SpacedRepetitionService {
  private localCards: SRSCard[] = [];

  /**
   * Get all cards for a user
   */
  async getUserCards(userId: string): Promise<SRSCard[]> {
    try {
      const response = await api.get(`/srs/cards?userId=${userId}`);
      this.localCards = response.data;
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch cards from server, using local cache:', error);
      return this.localCards;
    }
  }

  /**
   * Get cards that are due for review
   */
  async getDueCards(userId: string): Promise<SRSCard[]> {
    const allCards = await this.getUserCards(userId);
    return SpacedRepetitionAlgorithm.getDueCards(allCards);
  }

  /**
   * Create a new SRS card
   */
  async createCard(
    userId: string,
    front: string,
    back: string,
    context?: string,
    audioUrl?: string
  ): Promise<SRSCard> {
    const cardId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCard = SpacedRepetitionAlgorithm.createCard(cardId, front, back, context, audioUrl);

    try {
      await api.post('/srs/cards', {
        userId,
        card: newCard
      });
    } catch (error) {
      console.warn('Failed to save card to server, storing locally:', error);
    }

    // Update local cache
    this.localCards.push(newCard);
    return newCard;
  }

  /**
   * Update a card after review
   */
  async reviewCard(
    userId: string,
    cardId: string,
    quality: ReviewQuality
  ): Promise<SRSCard> {
    const card = this.localCards.find(c => c.id === cardId);
    if (!card) {
      throw new Error(`Card ${cardId} not found`);
    }

    const result = SpacedRepetitionAlgorithm.scheduleNextReview(card, quality);
    const updatedCard = result.card;

    try {
      await api.put(`/srs/cards/${cardId}`, {
        userId,
        card: updatedCard,
        quality
      });
    } catch (error) {
      console.warn('Failed to update card on server, updating locally:', error);
    }

    // Update local cache
    const cardIndex = this.localCards.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      this.localCards[cardIndex] = updatedCard;
    }

    return updatedCard;
  }

  /**
   * Start a new review session
   */
  async startReviewSession(userId: string, maxCards: number = 20): Promise<ReviewSession> {
    const dueCards = await this.getDueCards(userId);
    const sessionCards = dueCards.slice(0, maxCards);

    const session: ReviewSession = {
      cards: sessionCards,
      sessionStart: new Date(),
      cardsReviewed: 0,
      accuracy: 0
    };

    // Shuffle cards for variety
    session.cards = this.shuffleArray(session.cards);

    return session;
  }

  /**
   * Complete a review session
   */
  async completeReviewSession(
    userId: string,
    session: ReviewSession,
    responses: { cardId: string; quality: ReviewQuality }[]
  ): Promise<{ updatedCards: SRSCard[]; sessionStats: any }> {
    // Update all cards based on responses
    const updatedCards = [];
    const sessionStats = {
      cardsReviewed: responses.length,
      averageQuality: 0,
      accuracy: 0,
      duration: Date.now() - session.sessionStart.getTime()
    };

    let totalQuality = 0;
    let correctResponses = 0;

    for (const response of responses) {
      const updatedCard = await this.reviewCard(userId, response.cardId, response.quality);
      updatedCards.push(updatedCard);
      
      totalQuality += response.quality;
      if (response.quality >= ReviewQuality.HARD) {
        correctResponses++;
      }
    }

    sessionStats.averageQuality = totalQuality / responses.length;
    sessionStats.accuracy = correctResponses / responses.length;

    // Record session statistics
    try {
      await api.post('/srs/sessions', {
        userId,
        session: {
          ...session,
          cardsReviewed: sessionStats.cardsReviewed,
          accuracy: sessionStats.accuracy
        },
        stats: sessionStats
      });
    } catch (error) {
      console.warn('Failed to record session stats:', error);
    }

    return { updatedCards, sessionStats };
  }

  /**
   * Get memory strength for cards
   */
  getMemoryStrengths(cards: SRSCard[]): MemoryStrength[] {
    return cards.map(card => ({
      cardId: card.id,
      strength: SpacedRepetitionAlgorithm.calculateMemoryStrength(card),
      confidence: Math.min(100, card.repetitions * 20), // Rough confidence calculation
      lastCalculated: new Date()
    }));
  }

  /**
   * Get optimal review schedule for cards
   */
  getOptimalReviewSchedule(cards: SRSCard[]): Array<{ card: SRSCard; optimalTime: Date }> {
    return cards.map(card => ({
      card,
      optimalTime: SpacedRepetitionAlgorithm.getOptimalReviewTime(card)
    }));
  }

  /**
   * Import cards from vocabulary list
   */
  async importFromVocabulary(
    userId: string,
    vocabularyItems: Array<{ word: string; translation: string; context?: string }>
  ): Promise<SRSCard[]> {
    const importedCards = [];

    for (const item of vocabularyItems) {
      // Check if card already exists
      const existingCard = this.localCards.find(card => 
        card.front === item.word && card.back === item.translation
      );

      if (!existingCard) {
        const newCard = await this.createCard(
          userId,
          item.word,
          item.translation,
          item.context
        );
        importedCards.push(newCard);
      }
    }

    return importedCards;
  }

  /**
   * Get cards by difficulty level
   */
  getCardsByDifficulty(cards: SRSCard[], targetDifficulty: 'easy' | 'medium' | 'hard'): SRSCard[] {
    return cards.filter(card => {
      const strength = SpacedRepetitionAlgorithm.calculateMemoryStrength(card);
      
      switch (targetDifficulty) {
        case 'easy':
          return strength > 70;
        case 'medium':
          return strength >= 30 && strength <= 70;
        case 'hard':
          return strength < 30;
        default:
          return true;
      }
    });
  }

  /**
   * Utility method to shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.localCards = [];
  }

  /**
   * Sync local cache with server
   */
  async syncWithServer(userId: string): Promise<void> {
    try {
      const serverCards = await api.get(`/srs/cards?userId=${userId}`);
      this.localCards = serverCards.data;
    } catch (error) {
      console.warn('Failed to sync with server:', error);
    }
  }
}

export default new SpacedRepetitionService();