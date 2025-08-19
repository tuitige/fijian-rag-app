// services/analyticsService.ts
import api from './api';
import { 
  LearningInsight, 
  ProgressHeatmap, 
  SkillLevel, 
  FluencyPrediction,
  LearningPattern,
  StudyStreak,
  WeeklyReport
} from '../types/analytics';
import { ExerciseResult, ExerciseType } from '../types/exercises';
import { UserProgress } from '../types/progress';
import { FluencyCalculator } from '../algorithms/fluencyCalculator';

class AnalyticsService {
  private insightsCache: Map<string, { data: LearningInsight[]; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get learning insights for a user
   */
  async getLearningInsights(userId: string): Promise<LearningInsight[]> {
    // Check cache first
    const cached = this.insightsCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await api.get(`/analytics/insights?userId=${userId}`);
      const insights = response.data;
      
      // Cache the results
      this.insightsCache.set(userId, {
        data: insights,
        timestamp: Date.now()
      });
      
      return insights;
    } catch (error) {
      console.warn('Failed to fetch insights from server, generating locally:', error);
      return this.generateLocalInsights(userId);
    }
  }

  /**
   * Get progress heatmap data
   */
  async getProgressHeatmap(userId: string, days: number = 365): Promise<ProgressHeatmap[]> {
    try {
      const response = await api.get(`/analytics/heatmap?userId=${userId}&days=${days}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch heatmap data:', error);
      return this.generateMockHeatmap(days);
    }
  }

  /**
   * Get skill level breakdown
   */
  async getSkillLevels(userId: string): Promise<SkillLevel> {
    try {
      const response = await api.get(`/analytics/skills?userId=${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch skill levels:', error);
      
      // Calculate locally using available data
      const progress = await this.getUserProgress(userId);
      const exerciseResults = await this.getExerciseResults(userId);
      
      return FluencyCalculator.calculateSkillLevels(
        progress.vocabularyMastery,
        exerciseResults,
        progress.totalPracticeMinutes
      );
    }
  }

  /**
   * Get fluency prediction
   */
  async getFluencyPrediction(userId: string): Promise<FluencyPrediction> {
    try {
      const response = await api.get(`/analytics/fluency-prediction?userId=${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch fluency prediction:', error);
      
      // Calculate locally
      const progress = await this.getUserProgress(userId);
      const exerciseResults = await this.getExerciseResults(userId);
      
      return FluencyCalculator.predictFluency(
        progress.fluencyLevel,
        progress,
        exerciseResults
      );
    }
  }

  /**
   * Get learning patterns analysis
   */
  async getLearningPatterns(userId: string): Promise<LearningPattern> {
    try {
      const response = await api.get(`/analytics/patterns?userId=${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch learning patterns:', error);
      return this.analyzeLearningPatterns(userId);
    }
  }

  /**
   * Get study streak information
   */
  async getStudyStreak(userId: string): Promise<StudyStreak> {
    try {
      const response = await api.get(`/analytics/streak?userId=${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch streak data:', error);
      
      const progress = await this.getUserProgress(userId);
      return {
        current: progress.currentStreak,
        longest: progress.longestStreak,
        streakMultiplier: Math.min(2.0, 1 + (progress.currentStreak * 0.02)),
        lastPracticeDate: progress.lastPracticeDate,
        nextGoal: this.calculateNextStreakGoal(progress.currentStreak)
      };
    }
  }

  /**
   * Get weekly report
   */
  async getWeeklyReport(userId: string, weekStart?: Date): Promise<WeeklyReport> {
    const startDate = weekStart || this.getStartOfWeek(new Date());
    
    try {
      const response = await api.get(`/analytics/weekly-report?userId=${userId}&weekStart=${startDate.toISOString()}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch weekly report:', error);
      return this.generateWeeklyReport(userId, startDate);
    }
  }

  /**
   * Track learning event for analytics
   */
  async trackEvent(
    userId: string,
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      await api.post('/analytics/events', {
        userId,
        eventType,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to track event:', error);
      // Store locally for later sync
      this.storeEventLocally(userId, eventType, data);
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(
    userId: string,
    metric: 'accuracy' | 'speed' | 'streak' | 'vocabulary',
    days: number = 30
  ): Promise<Array<{ date: string; value: number }>> {
    try {
      const response = await api.get(`/analytics/trends?userId=${userId}&metric=${metric}&days=${days}`);
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch performance trends:', error);
      return this.generateMockTrends(metric, days);
    }
  }

  /**
   * Generate recommendations based on analytics
   */
  async getRecommendations(userId: string): Promise<Array<{
    type: 'exercise' | 'study_time' | 'difficulty' | 'focus_area';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    actionUrl?: string;
  }>> {
    const insights = await this.getLearningInsights(userId);
    const patterns = await this.getLearningPatterns(userId);
    const skillLevels = await this.getSkillLevels(userId);
    
    const recommendations = [];

    // Analyze weak areas and suggest focus
    const weakestSkill = Object.entries(skillLevels.breakdown)
      .sort(([,a], [,b]) => a - b)[0];
    
    if (weakestSkill[1] < 60) {
      recommendations.push({
        type: 'focus_area' as const,
        title: `Focus on ${weakestSkill[0]}`,
        description: `Your ${weakestSkill[0]} skills could use some attention. Try specific exercises for this area.`,
        priority: 'high' as const,
        actionUrl: `/exercises?focus=${weakestSkill[0]}`
      });
    }

    // Study time recommendations
    if (patterns.averageSessionLength < 10) {
      recommendations.push({
        type: 'study_time' as const,
        title: 'Try longer study sessions',
        description: 'Consider extending your study sessions to 15-20 minutes for better retention.',
        priority: 'medium' as const
      });
    }

    // Peak performance suggestions
    if (patterns.bestStudyTime && patterns.peakPerformanceDays.length > 0) {
      recommendations.push({
        type: 'study_time' as const,
        title: 'Optimize your study schedule',
        description: `You perform best at ${patterns.bestStudyTime} on ${patterns.peakPerformanceDays.join(', ')}.`,
        priority: 'medium' as const
      });
    }

    return recommendations;
  }

  /**
   * Generate local insights when server is unavailable
   */
  private async generateLocalInsights(userId: string): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    try {
      const progress = await this.getUserProgress(userId);
      const exerciseResults = await this.getExerciseResults(userId);
      
      // Streak insight
      if (progress.currentStreak > 0) {
        insights.push({
          type: 'trend',
          title: 'Current Streak',
          description: `You're on a ${progress.currentStreak}-day learning streak!`,
          metric: progress.currentStreak,
          unit: 'days',
          icon: '🔥'
        });
      }

      // Vocabulary growth
      insights.push({
        type: 'strength',
        title: 'Vocabulary Growth',
        description: `You've learned ${progress.totalWordsLearned} words`,
        metric: progress.totalWordsLearned,
        unit: 'words',
        icon: '📚'
      });

      // Recent performance
      if (exerciseResults.length > 0) {
        const recentAccuracy = exerciseResults
          .slice(-5)
          .reduce((sum, result) => sum + result.accuracy, 0) / Math.min(5, exerciseResults.length);
        
        insights.push({
          type: recentAccuracy > 0.8 ? 'strength' : 'weakness',
          title: 'Recent Performance',
          description: `${Math.round(recentAccuracy * 100)}% accuracy in recent exercises`,
          metric: Math.round(recentAccuracy * 100),
          unit: '%',
          icon: recentAccuracy > 0.8 ? '🎯' : '📈'
        });
      }
    } catch (error) {
      console.warn('Failed to generate local insights:', error);
    }

    return insights;
  }

  /**
   * Generate mock heatmap data
   */
  private generateMockHeatmap(days: number): ProgressHeatmap[] {
    const heatmap: ProgressHeatmap[] = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      heatmap.push({
        date: date.toISOString().split('T')[0],
        value: Math.random() * 100,
        sessions: Math.floor(Math.random() * 5),
        wordsLearned: Math.floor(Math.random() * 10)
      });
    }
    
    return heatmap;
  }

  /**
   * Analyze learning patterns locally
   */
  private async analyzeLearningPatterns(userId: string): Promise<LearningPattern> {
    // Mock implementation - would analyze actual user data
    return {
      bestStudyTime: '19:00', // 7 PM
      averageSessionLength: 12, // minutes
      preferredExerciseTypes: [ExerciseType.MULTIPLE_CHOICE, ExerciseType.TRANSLATION],
      peakPerformanceDays: ['Monday', 'Wednesday', 'Friday'],
      strugglingAreas: ['listening', 'pronunciation']
    };
  }

  /**
   * Generate weekly report locally
   */
  private async generateWeeklyReport(userId: string, weekStart: Date): Promise<WeeklyReport> {
    // Mock implementation
    return {
      weekStart,
      totalMinutes: 85,
      wordsLearned: 12,
      exercisesCompleted: 8,
      averageAccuracy: 0.78,
      improvementAreas: ['listening comprehension'],
      achievements: ['5-day streak', 'vocabulary milestone']
    };
  }

  /**
   * Generate mock performance trends
   */
  private generateMockTrends(metric: string, days: number): Array<{ date: string; value: number }> {
    const trends = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        value: Math.random() * 100
      });
    }
    
    return trends;
  }

  /**
   * Helper method to get user progress
   */
  private async getUserProgress(userId: string): Promise<UserProgress> {
    try {
      const response = await api.get(`/progress/dashboard?userId=${userId}`);
      return response.data;
    } catch (error) {
      throw new Error('Could not fetch user progress');
    }
  }

  /**
   * Helper method to get exercise results
   */
  private async getExerciseResults(userId: string): Promise<ExerciseResult[]> {
    try {
      const response = await api.get(`/exercises/history?userId=${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Could not fetch exercise results');
      return [];
    }
  }

  /**
   * Calculate next streak goal
   */
  private calculateNextStreakGoal(currentStreak: number): number {
    const milestones = [7, 14, 30, 60, 100, 200, 365];
    return milestones.find(milestone => milestone > currentStreak) || currentStreak + 50;
  }

  /**
   * Get start of week (Monday)
   */
  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    return new Date(d.setDate(diff));
  }

  /**
   * Store event locally for offline capability
   */
  private storeEventLocally(userId: string, eventType: string, data: Record<string, any>): void {
    const events = JSON.parse(localStorage.getItem(`analytics_events_${userId}`) || '[]');
    events.push({
      eventType,
      data,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 events
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    
    localStorage.setItem(`analytics_events_${userId}`, JSON.stringify(events));
  }

  /**
   * Clear analytics cache
   */
  clearCache(): void {
    this.insightsCache.clear();
  }

  /**
   * Sync offline events with server
   */
  async syncOfflineEvents(userId: string): Promise<void> {
    const events = JSON.parse(localStorage.getItem(`analytics_events_${userId}`) || '[]');
    
    if (events.length === 0) return;

    try {
      await api.post('/analytics/events/batch', {
        userId,
        events
      });
      
      // Clear local storage after successful sync
      localStorage.removeItem(`analytics_events_${userId}`);
    } catch (error) {
      console.warn('Failed to sync offline events:', error);
    }
  }
}

const analyticsService = new AnalyticsService();
export default analyticsService;