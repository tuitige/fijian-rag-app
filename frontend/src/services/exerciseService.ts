// services/exerciseService.ts
import api from './api';
import { 
  ExerciseType, 
  ExerciseQuestion, 
  ExerciseSession, 
  ExerciseResponse, 
  ExerciseResult,
  ExerciseSettings 
} from '../types/exercises';
import { DifficultyAdapter } from '../algorithms/difficultyAdapter';

class ExerciseService {
  private currentSession: ExerciseSession | null = null;

  /**
   * Get available exercise types based on user level
   */
  getAvailableExerciseTypes(userLevel: number): ExerciseType[] {
    const allTypes = Object.values(ExerciseType);
    
    // Unlock exercise types progressively
    if (userLevel < 20) {
      return [ExerciseType.MULTIPLE_CHOICE];
    } else if (userLevel < 40) {
      return [ExerciseType.MULTIPLE_CHOICE, ExerciseType.FILL_IN_BLANK];
    } else if (userLevel < 60) {
      return [
        ExerciseType.MULTIPLE_CHOICE, 
        ExerciseType.FILL_IN_BLANK, 
        ExerciseType.TRANSLATION
      ];
    } else if (userLevel < 80) {
      return [
        ExerciseType.MULTIPLE_CHOICE,
        ExerciseType.FILL_IN_BLANK,
        ExerciseType.TRANSLATION,
        ExerciseType.LISTENING
      ];
    } else {
      return allTypes;
    }
  }

  /**
   * Start a new exercise session
   */
  async startExerciseSession(
    userId: string,
    exerciseType: ExerciseType,
    settings: ExerciseSettings,
    questionCount: number = 10
  ): Promise<ExerciseSession> {
    try {
      const response = await api.post('/exercises/session/start', {
        userId,
        exerciseType,
        settings,
        questionCount
      });

      const questions = response.data.questions || await this.generateQuestions(
        exerciseType, 
        settings.difficultyLevel, 
        questionCount
      );

      this.currentSession = {
        id: `session-${Date.now()}`,
        userId,
        type: exerciseType,
        questions,
        currentQuestionIndex: 0,
        score: 0,
        totalQuestions: questions.length,
        startTime: new Date(),
        responses: []
      };

      return this.currentSession;
    } catch (error) {
      console.warn('Failed to start session on server, generating locally:', error);
      
      // Fallback to local generation
      const questions = await this.generateQuestions(
        exerciseType, 
        settings.difficultyLevel, 
        questionCount
      );

      this.currentSession = {
        id: `session-${Date.now()}`,
        userId,
        type: exerciseType,
        questions,
        currentQuestionIndex: 0,
        score: 0,
        totalQuestions: questions.length,
        startTime: new Date(),
        responses: []
      };

      return this.currentSession;
    }
  }

  /**
   * Submit an answer for the current question
   */
  async submitAnswer(
    userAnswer: string | string[],
    timeSpent: number,
    hintsUsed: number = 0
  ): Promise<{ isCorrect: boolean; explanation?: string; nextQuestion?: ExerciseQuestion }> {
    if (!this.currentSession) {
      throw new Error('No active exercise session');
    }

    const currentQuestion = this.currentSession.questions[this.currentSession.currentQuestionIndex];
    const isCorrect = this.checkAnswer(currentQuestion, userAnswer);

    const response: ExerciseResponse = {
      questionId: currentQuestion.id,
      userAnswer,
      isCorrect,
      timeSpent,
      hintsUsed,
      timestamp: new Date()
    };

    this.currentSession.responses.push(response);
    
    if (isCorrect) {
      this.currentSession.score++;
    }

    // Move to next question
    this.currentSession.currentQuestionIndex++;

    const result = {
      isCorrect,
      explanation: this.generateExplanation(currentQuestion, userAnswer, isCorrect),
      nextQuestion: this.currentSession.currentQuestionIndex < this.currentSession.totalQuestions 
        ? this.currentSession.questions[this.currentSession.currentQuestionIndex]
        : undefined
    };

    // Save progress to server
    try {
      await api.post(`/exercises/session/${this.currentSession.id}/answer`, {
        response,
        sessionProgress: {
          currentIndex: this.currentSession.currentQuestionIndex,
          score: this.currentSession.score
        }
      });
    } catch (error) {
      console.warn('Failed to save answer to server:', error);
    }

    return result;
  }

  /**
   * Complete the current exercise session
   */
  async completeSession(): Promise<ExerciseResult> {
    if (!this.currentSession) {
      throw new Error('No active exercise session');
    }

    this.currentSession.endTime = new Date();
    
    const accuracy = this.currentSession.score / this.currentSession.totalQuestions;
    const totalTime = this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();
    const averageTime = totalTime / this.currentSession.responses.length;

    const result: ExerciseResult = {
      session: this.currentSession,
      accuracy,
      averageTime,
      difficultyProgression: this.calculateDifficultyProgression(accuracy, averageTime),
      strengthAreas: this.identifyStrengthAreas(),
      weaknessAreas: this.identifyWeaknessAreas()
    };

    // Save result to server
    try {
      await api.post('/exercises/results', {
        userId: this.currentSession.userId,
        result
      });
    } catch (error) {
      console.warn('Failed to save exercise result to server:', error);
    }

    // Clear current session
    this.currentSession = null;

    return result;
  }

  /**
   * Get exercise history for a user
   */
  async getExerciseHistory(
    userId: string,
    exerciseType?: ExerciseType,
    limit: number = 50
  ): Promise<ExerciseResult[]> {
    try {
      const response = await api.get('/exercises/history', {
        params: {
          userId,
          exerciseType,
          limit
        }
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch exercise history:', error);
      return [];
    }
  }

  /**
   * Get recommended difficulty for user
   */
  async getRecommendedDifficulty(
    userId: string,
    exerciseType: ExerciseType
  ): Promise<number> {
    const history = await this.getExerciseHistory(userId, exerciseType, 10);
    
    if (history.length === 0) {
      return 2; // Start with easy-medium difficulty
    }

    return DifficultyAdapter.getDifficultyForExerciseType(exerciseType, 50, history);
  }

  /**
   * Generate questions for an exercise type (mock implementation)
   */
  private async generateQuestions(
    exerciseType: ExerciseType,
    difficulty: number,
    count: number
  ): Promise<ExerciseQuestion[]> {
    // This would normally fetch from a question bank or generate dynamically
    const questions: ExerciseQuestion[] = [];
    
    for (let i = 0; i < count; i++) {
      questions.push(this.createMockQuestion(exerciseType, difficulty, i));
    }

    return questions;
  }

  /**
   * Create a mock question for testing
   */
  private createMockQuestion(
    type: ExerciseType,
    difficulty: number,
    index: number
  ): ExerciseQuestion {
    const questionId = `${type}-${difficulty}-${index}`;
    
    switch (type) {
      case ExerciseType.MULTIPLE_CHOICE:
        return {
          id: questionId,
          type,
          question: 'What does "bula" mean in English?',
          options: ['Hello', 'Goodbye', 'Thank you', 'Please'],
          correctAnswer: 'Hello',
          hint: 'It\'s a common greeting in Fiji',
          difficulty
        };
        
      case ExerciseType.FILL_IN_BLANK:
        return {
          id: questionId,
          type,
          question: 'Bula, ___ yani? (Hello, how are you?)',
          correctAnswer: 'sa',
          hint: 'This word means "how" in this context',
          difficulty
        };
        
      case ExerciseType.TRANSLATION:
        return {
          id: questionId,
          type,
          question: 'Translate: "Good morning" to Fijian',
          correctAnswer: 'yadra',
          difficulty
        };
        
      case ExerciseType.LISTENING:
        return {
          id: questionId,
          type,
          question: 'Listen to the audio and choose the correct translation',
          options: ['Good morning', 'Good evening', 'Good night', 'Good afternoon'],
          correctAnswer: 'Good morning',
          audioUrl: '/audio/yadra.mp3',
          difficulty
        };
        
      case ExerciseType.SENTENCE_BUILDER:
        return {
          id: questionId,
          type,
          question: 'Build the sentence: "I am fine"',
          correctAnswer: ['au', 'sa', 'bula', 'vinaka'],
          hint: 'Start with the pronoun "I"',
          difficulty
        };
        
      default:
        throw new Error(`Unknown exercise type: ${type}`);
    }
  }

  /**
   * Check if user answer is correct
   */
  private checkAnswer(question: ExerciseQuestion, userAnswer: string | string[]): boolean {
    if (Array.isArray(question.correctAnswer)) {
      if (!Array.isArray(userAnswer)) return false;
      return JSON.stringify(question.correctAnswer.sort()) === JSON.stringify(userAnswer.sort());
    }
    
    if (Array.isArray(userAnswer)) return false;
    
    return question.correctAnswer.toLowerCase().trim() === userAnswer.toLowerCase().trim();
  }

  /**
   * Generate explanation for the answer
   */
  private generateExplanation(
    question: ExerciseQuestion,
    userAnswer: string | string[],
    isCorrect: boolean
  ): string {
    if (isCorrect) {
      return 'Correct! ' + (question.context || 'Well done!');
    }

    const correctAnswer = Array.isArray(question.correctAnswer) 
      ? question.correctAnswer.join(' ')
      : question.correctAnswer;
      
    return `Incorrect. The correct answer is "${correctAnswer}". ${question.context || ''}`;
  }

  /**
   * Calculate difficulty progression based on performance
   */
  private calculateDifficultyProgression(accuracy: number, averageTime: number): number {
    // Return value between -1 (decrease difficulty) and 1 (increase difficulty)
    if (accuracy > 0.85 && averageTime < 8000) return 0.5;
    if (accuracy > 0.75 && averageTime < 10000) return 0.25;
    if (accuracy < 0.6) return -0.5;
    if (accuracy < 0.7) return -0.25;
    return 0;
  }

  /**
   * Identify strength areas based on current session
   */
  private identifyStrengthAreas(): string[] {
    if (!this.currentSession) return [];
    
    const strengths = [];
    const correctRate = this.currentSession.score / this.currentSession.responses.length;
    
    if (correctRate > 0.8) strengths.push('Vocabulary Recognition');
    if (this.currentSession.responses.some(r => r.timeSpent < 5000)) {
      strengths.push('Quick Recall');
    }
    
    return strengths;
  }

  /**
   * Identify weakness areas based on current session
   */
  private identifyWeaknessAreas(): string[] {
    if (!this.currentSession) return [];
    
    const weaknesses = [];
    const correctRate = this.currentSession.score / this.currentSession.responses.length;
    
    if (correctRate < 0.6) weaknesses.push('Vocabulary Knowledge');
    if (this.currentSession.responses.some(r => r.timeSpent > 15000)) {
      weaknesses.push('Response Speed');
    }
    
    return weaknesses;
  }

  /**
   * Get current session progress
   */
  getCurrentSession(): ExerciseSession | null {
    return this.currentSession;
  }

  /**
   * Abandon current session
   */
  abandonSession(): void {
    this.currentSession = null;
  }
}

export default new ExerciseService();