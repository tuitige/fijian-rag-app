// algorithms/difficultyAdapter.ts
import { ExerciseResult, ExerciseType } from '../types/exercises';

/**
 * Adaptive difficulty system that adjusts exercise difficulty based on performance
 */
export class DifficultyAdapter {
  private static readonly MIN_DIFFICULTY = 1;
  private static readonly MAX_DIFFICULTY = 5;
  private static readonly TARGET_ACCURACY = 0.75; // 75% target accuracy

  /**
   * Calculate new difficulty level based on recent performance
   */
  static adaptDifficulty(
    currentDifficulty: number,
    recentResults: ExerciseResult[]
  ): number {
    if (recentResults.length === 0) return currentDifficulty;

    const recentAccuracy = this.calculateAverageAccuracy(recentResults);
    const recentAverageTime = this.calculateAverageTime(recentResults);
    
    // Calculate difficulty adjustment based on accuracy
    const accuracyDelta = recentAccuracy - this.TARGET_ACCURACY;
    let adjustment = 0;

    if (accuracyDelta > 0.1) {
      // Too easy - increase difficulty
      adjustment = 0.5;
    } else if (accuracyDelta < -0.1) {
      // Too hard - decrease difficulty
      adjustment = -0.5;
    } else if (accuracyDelta > 0.05) {
      // Slightly easy
      adjustment = 0.25;
    } else if (accuracyDelta < -0.05) {
      // Slightly hard
      adjustment = -0.25;
    }

    // Factor in response time (faster responses = can handle higher difficulty)
    const timeBonus = this.calculateTimeBonus(recentAverageTime);
    adjustment += timeBonus;

    const newDifficulty = currentDifficulty + adjustment;
    return Math.max(
      this.MIN_DIFFICULTY,
      Math.min(this.MAX_DIFFICULTY, Math.round(newDifficulty * 4) / 4) // Round to quarters
    );
  }

  /**
   * Get difficulty level for a specific exercise type and user performance
   */
  static getDifficultyForExerciseType(
    exerciseType: ExerciseType,
    userLevel: number,
    recentResults: ExerciseResult[]
  ): number {
    const baselineDifficulty = this.getBaselineDifficulty(exerciseType, userLevel);
    
    // Filter results for this specific exercise type
    const typeSpecificResults = recentResults.filter(
      result => result.session.type === exerciseType
    );

    if (typeSpecificResults.length < 3) {
      return baselineDifficulty;
    }

    return this.adaptDifficulty(baselineDifficulty, typeSpecificResults);
  }

  /**
   * Calculate baseline difficulty based on exercise type and user level
   */
  private static getBaselineDifficulty(
    exerciseType: ExerciseType,
    userLevel: number
  ): number {
    const levelMultiplier = userLevel / 100; // Convert to 0-1 scale

    const difficultyMap: Record<ExerciseType, number> = {
      [ExerciseType.MULTIPLE_CHOICE]: 2.0 + levelMultiplier * 2.0,
      [ExerciseType.FILL_IN_BLANK]: 2.5 + levelMultiplier * 2.0,
      [ExerciseType.TRANSLATION]: 3.0 + levelMultiplier * 1.5,
      [ExerciseType.LISTENING]: 3.5 + levelMultiplier * 1.0,
      [ExerciseType.SENTENCE_BUILDER]: 4.0 + levelMultiplier * 0.5
    };

    return Math.max(
      this.MIN_DIFFICULTY,
      Math.min(this.MAX_DIFFICULTY, difficultyMap[exerciseType])
    );
  }

  /**
   * Calculate average accuracy from recent results
   */
  private static calculateAverageAccuracy(results: ExerciseResult[]): number {
    if (results.length === 0) return 0;
    
    const totalAccuracy = results.reduce((sum, result) => sum + result.accuracy, 0);
    return totalAccuracy / results.length;
  }

  /**
   * Calculate average response time from recent results
   */
  private static calculateAverageTime(results: ExerciseResult[]): number {
    if (results.length === 0) return 0;
    
    const totalTime = results.reduce((sum, result) => sum + result.averageTime, 0);
    return totalTime / results.length;
  }

  /**
   * Calculate time bonus for difficulty adjustment
   */
  private static calculateTimeBonus(averageTime: number): number {
    // Assume baseline time is 10 seconds per question
    const baselineTime = 10000; // milliseconds
    
    if (averageTime < baselineTime * 0.7) {
      // Very fast responses - increase difficulty
      return 0.25;
    } else if (averageTime < baselineTime * 0.85) {
      // Fast responses - slight increase
      return 0.1;
    } else if (averageTime > baselineTime * 1.5) {
      // Slow responses - decrease difficulty
      return -0.25;
    } else if (averageTime > baselineTime * 1.2) {
      // Slightly slow - slight decrease
      return -0.1;
    }
    
    return 0; // Normal time
  }

  /**
   * Predict optimal difficulty for next session
   */
  static predictOptimalDifficulty(
    userId: string,
    exerciseType: ExerciseType,
    historicalResults: ExerciseResult[]
  ): number {
    // Get recent performance trend
    const recentResults = historicalResults
      .filter(result => result.session.type === exerciseType)
      .slice(-10); // Last 10 sessions

    if (recentResults.length < 2) {
      return this.MIN_DIFFICULTY + 1; // Conservative start
    }

    // Calculate trend in performance
    const firstHalf = recentResults.slice(0, Math.floor(recentResults.length / 2));
    const secondHalf = recentResults.slice(Math.floor(recentResults.length / 2));

    const firstHalfAccuracy = this.calculateAverageAccuracy(firstHalf);
    const secondHalfAccuracy = this.calculateAverageAccuracy(secondHalf);

    const improvementTrend = secondHalfAccuracy - firstHalfAccuracy;

    // Base difficulty on recent performance
    const currentDifficulty = this.adaptDifficulty(3, recentResults);

    // Adjust for improvement trend
    if (improvementTrend > 0.1) {
      // Improving rapidly - can handle more challenge
      return Math.min(this.MAX_DIFFICULTY, currentDifficulty + 0.5);
    } else if (improvementTrend < -0.1) {
      // Performance declining - ease up
      return Math.max(this.MIN_DIFFICULTY, currentDifficulty - 0.5);
    }

    return currentDifficulty;
  }
}