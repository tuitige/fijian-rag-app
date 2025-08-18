// algorithms/fluencyCalculator.ts
import { VocabularyItem, UserProgress } from '../types/progress';
import { ExerciseResult } from '../types/exercises';
import { FluencyPrediction, SkillLevel } from '../types/analytics';

/**
 * Calculate user fluency levels and predictions based on learning data
 */
export class FluencyCalculator {
  private static readonly SKILL_WEIGHTS = {
    vocabulary: 0.3,
    grammar: 0.2,
    listening: 0.2,
    speaking: 0.15,
    reading: 0.1,
    writing: 0.05
  };

  /**
   * Calculate overall fluency level based on various skill components
   */
  static calculateFluencyLevel(
    vocabulary: VocabularyItem[],
    exerciseResults: ExerciseResult[],
    totalPracticeMinutes: number
  ): number {
    const skillLevels = this.calculateSkillLevels(vocabulary, exerciseResults, totalPracticeMinutes);
    
    let weightedScore = 0;
    for (const [skill, weight] of Object.entries(this.SKILL_WEIGHTS)) {
      weightedScore += skillLevels.breakdown[skill as keyof typeof skillLevels.breakdown] * weight;
    }

    return Math.round(weightedScore);
  }

  /**
   * Calculate individual skill levels
   */
  static calculateSkillLevels(
    vocabulary: VocabularyItem[],
    exerciseResults: ExerciseResult[],
    totalPracticeMinutes: number
  ): SkillLevel {
    const vocabularyScore = this.calculateVocabularyScore(vocabulary);
    const grammarScore = this.calculateGrammarScore(exerciseResults);
    const listeningScore = this.calculateListeningScore(exerciseResults);
    const speakingScore = this.calculateSpeakingScore(totalPracticeMinutes, exerciseResults);
    const readingScore = this.calculateReadingScore(exerciseResults);
    const writingScore = this.calculateWritingScore(exerciseResults);

    const overallLevel = (
      vocabularyScore * this.SKILL_WEIGHTS.vocabulary +
      grammarScore * this.SKILL_WEIGHTS.grammar +
      listeningScore * this.SKILL_WEIGHTS.listening +
      speakingScore * this.SKILL_WEIGHTS.speaking +
      readingScore * this.SKILL_WEIGHTS.reading +
      writingScore * this.SKILL_WEIGHTS.writing
    );

    return {
      skill: 'overall',
      level: Math.round(overallLevel),
      breakdown: {
        vocabulary: vocabularyScore,
        grammar: grammarScore,
        listening: listeningScore,
        speaking: speakingScore,
        reading: readingScore,
        writing: writingScore
      }
    };
  }

  /**
   * Predict fluency progression based on current performance and practice patterns
   */
  static predictFluency(
    currentLevel: number,
    practiceHistory: UserProgress,
    exerciseResults: ExerciseResult[]
  ): FluencyPrediction {
    const studyFrequency = this.calculateStudyFrequency(practiceHistory);
    const sessionQuality = this.calculateSessionQuality(exerciseResults);
    const retentionRate = this.calculateRetentionRate(practiceHistory.vocabularyMastery);
    const difficultyProgression = this.calculateDifficultyProgression(exerciseResults);

    // Prediction formula based on learning curve research
    const progressionRate = (
      studyFrequency * 0.4 +
      sessionQuality * 0.3 +
      retentionRate * 0.2 +
      difficultyProgression * 0.1
    );

    const targetLevel = 90; // Assume target is 90% fluency
    const remainingProgress = targetLevel - currentLevel;
    
    // Time estimation (days) - diminishing returns as level increases
    const difficultyMultiplier = Math.exp(currentLevel / 100); // Exponential difficulty increase
    const baseTimeToGoal = remainingProgress * 2; // Base 2 days per percent
    const adjustedTime = baseTimeToGoal * difficultyMultiplier / Math.max(0.1, progressionRate);

    const predictedLevel = Math.min(100, currentLevel + (progressionRate * 30)); // 30-day prediction

    return {
      currentLevel,
      predictedLevel: Math.round(predictedLevel),
      timeToGoal: Math.round(adjustedTime),
      confidence: this.calculatePredictionConfidence(exerciseResults.length, studyFrequency),
      factors: {
        studyFrequency,
        sessionQuality,
        retentionRate,
        difficultyProgression
      }
    };
  }

  private static calculateVocabularyScore(vocabulary: VocabularyItem[]): number {
    if (vocabulary.length === 0) return 0;

    // Score based on words learned and mastery levels
    const totalMastery = vocabulary.reduce((sum, item) => sum + item.masteryLevel, 0);
    const maxPossibleMastery = vocabulary.length * 5;
    const masteryScore = (totalMastery / maxPossibleMastery) * 100;

    // Bonus for vocabulary size (logarithmic scale)
    const sizeBonus = Math.min(20, Math.log10(vocabulary.length + 1) * 10);

    return Math.min(100, masteryScore + sizeBonus);
  }

  private static calculateGrammarScore(exerciseResults: ExerciseResult[]): number {
    const grammarExercises = exerciseResults.filter(
      result => result.session.type === 'fill_in_blank' || 
               result.session.type === 'sentence_builder'
    );

    if (grammarExercises.length === 0) return 0;

    const averageAccuracy = grammarExercises.reduce(
      (sum, result) => sum + result.accuracy, 0
    ) / grammarExercises.length;

    return Math.round(averageAccuracy * 100);
  }

  private static calculateListeningScore(exerciseResults: ExerciseResult[]): number {
    const listeningExercises = exerciseResults.filter(
      result => result.session.type === 'listening'
    );

    if (listeningExercises.length === 0) return 0;

    const averageAccuracy = listeningExercises.reduce(
      (sum, result) => sum + result.accuracy, 0
    ) / listeningExercises.length;

    return Math.round(averageAccuracy * 100);
  }

  private static calculateSpeakingScore(
    totalPracticeMinutes: number, 
    exerciseResults: ExerciseResult[]
  ): number {
    // Speaking score based on practice time and pronunciation exercises
    const practiceBonus = Math.min(50, totalPracticeMinutes / 10);
    
    // TODO: Add pronunciation exercise results when implemented
    const pronunciationScore = 0;

    return Math.round(practiceBonus + pronunciationScore);
  }

  private static calculateReadingScore(exerciseResults: ExerciseResult[]): number {
    const readingExercises = exerciseResults.filter(
      result => result.session.type === 'translation' || 
               result.session.type === 'multiple_choice'
    );

    if (readingExercises.length === 0) return 0;

    const averageAccuracy = readingExercises.reduce(
      (sum, result) => sum + result.accuracy, 0
    ) / readingExercises.length;

    return Math.round(averageAccuracy * 100);
  }

  private static calculateWritingScore(exerciseResults: ExerciseResult[]): number {
    const writingExercises = exerciseResults.filter(
      result => result.session.type === 'translation'
    );

    if (writingExercises.length === 0) return 0;

    const averageAccuracy = writingExercises.reduce(
      (sum, result) => sum + result.accuracy, 0
    ) / writingExercises.length;

    return Math.round(averageAccuracy * 100);
  }

  private static calculateStudyFrequency(progress: UserProgress): number {
    // Calculate based on current streak and practice regularity
    const streakBonus = Math.min(1, progress.currentStreak / 30); // Max bonus at 30 days
    return streakBonus;
  }

  private static calculateSessionQuality(exerciseResults: ExerciseResult[]): number {
    if (exerciseResults.length === 0) return 0;

    const recentResults = exerciseResults.slice(-10); // Last 10 sessions
    const averageAccuracy = recentResults.reduce(
      (sum, result) => sum + result.accuracy, 0
    ) / recentResults.length;

    return averageAccuracy;
  }

  private static calculateRetentionRate(vocabulary: VocabularyItem[]): number {
    if (vocabulary.length === 0) return 0;

    // Calculate based on vocabulary mastery levels
    const highMasteryWords = vocabulary.filter(item => item.masteryLevel >= 4).length;
    return highMasteryWords / vocabulary.length;
  }

  private static calculateDifficultyProgression(exerciseResults: ExerciseResult[]): number {
    if (exerciseResults.length < 5) return 0.5; // Default middle value

    const recentResults = exerciseResults.slice(-10);
    const averageDifficulty = recentResults.reduce(
      (sum, result) => sum + result.difficultyProgression, 0
    ) / recentResults.length;

    return Math.max(0, Math.min(1, averageDifficulty + 0.5));
  }

  private static calculatePredictionConfidence(
    dataPoints: number, 
    studyFrequency: number
  ): number {
    // Confidence based on amount of data and study consistency
    const dataConfidence = Math.min(100, dataPoints * 5); // 5% per exercise result
    const frequencyConfidence = studyFrequency * 100;
    
    return Math.round((dataConfidence + frequencyConfidence) / 2);
  }
}