/**
 * Fijian RAG App - Progress Tracking Handler
 * 
 * This Lambda function handles:
 * 1. GET /progress/dashboard - Get user progress dashboard
 * 2. GET /progress/stats - Get detailed progress statistics
 * 3. GET /progress/vocabulary - Get user's vocabulary list
 * 4. GET /progress/achievements - Get user's achievements
 * 5. GET /progress/streak - Get user's learning streak
 * 6. POST /progress/practice-session - Record practice session
 * 7. POST /progress/word-learned - Record word learned
 * 8. POST /progress/chat-message - Record chat message
 * 9. POST /progress/vocabulary/:wordId/practice - Record word practice
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, QueryCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import jwt from 'jsonwebtoken';

// Configuration constants
const USER_PROGRESS_TABLE = process.env.USER_PROGRESS_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;

const ddbClient = new DynamoDBClient({});

/**
 * Creates a standardized JSON response with CORS headers
 */
function jsonResponse(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Verifies JWT token and extracts user ID
 */
function extractUserIdFromToken(event: APIGatewayProxyEvent): string | null {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

/**
 * Records user activity for progress tracking
 */
async function recordUserProgress(userId: string, action: string, data: any): Promise<void> {
  try {
    const timestamp = Date.now();
    const params = {
      TableName: USER_PROGRESS_TABLE,
      Item: marshall({
        userId,
        timestamp,
        action,
        data,
        createdAt: new Date().toISOString()
      })
    };

    await ddbClient.send(new PutItemCommand(params));
  } catch (error) {
    console.error('Error recording user progress:', error);
    throw error;
  }
}

/**
 * Gets user progress data
 */
async function getUserProgressData(userId: string): Promise<any[]> {
  try {
    const params = {
      TableName: USER_PROGRESS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId
      }),
      ScanIndexForward: false // Latest first
    };

    const result = await ddbClient.send(new QueryCommand(params));
    
    if (!result.Items) {
      return [];
    }

    return result.Items.map(item => unmarshall(item));
  } catch (error) {
    console.error('Error getting user progress data:', error);
    return [];
  }
}

/**
 * Calculates user progress dashboard data
 */
function calculateProgressDashboard(progressData: any[]): any {
  const wordsLearned = new Set();
  const chatMessages = progressData.filter(item => item.action === 'chat_message');
  const practiceData = progressData.filter(item => item.action === 'practice_session');
  const wordData = progressData.filter(item => item.action === 'word_learned');
  
  // Calculate total practice minutes
  const totalPracticeMinutes = practiceData.reduce((sum, item) => {
    return sum + (item.data?.duration || 0);
  }, 0);

  // Track unique words learned
  wordData.forEach(item => {
    if (item.data?.word) {
      wordsLearned.add(item.data.word);
    }
  });

  // Calculate streak
  const practiceDates = [...new Set(progressData.map(item => 
    new Date(item.createdAt).toDateString()
  ))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let currentStreak = 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

  for (let i = 0; i < practiceDates.length; i++) {
    const date = practiceDates[i];
    if (i === 0 && (date === today || date === yesterday)) {
      currentStreak++;
    } else if (i > 0) {
      const prevDate = new Date(practiceDates[i - 1]);
      const currDate = new Date(date);
      const daysDiff = Math.abs(prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak (simplified)
  const longestStreak = Math.max(currentStreak, practiceDates.length);

  // Calculate fluency level (simplified)
  const fluencyLevel = Math.min(100, Math.round((wordsLearned.size / 100) * 100));

  // Create vocabulary mastery data
  const vocabularyMastery = Array.from(wordsLearned).map(word => {
    const wordEntry = wordData.find(item => item.data?.word === word);
    return {
      word,
      translation: wordEntry?.data?.translation || '',
      firstSeen: wordEntry?.createdAt || new Date().toISOString(),
      lastPracticed: wordEntry?.createdAt || new Date().toISOString(),
      masteryLevel: 1,
      timesCorrect: 1,
      timesIncorrect: 0
    };
  });

  // Calculate achievements
  const achievements = [];
  
  if (wordsLearned.size >= 1) {
    achievements.push({
      id: 'first_word',
      name: 'First Steps',
      description: 'Learn your first word',
      icon: '👶',
      unlockedAt: wordData[0]?.createdAt || new Date().toISOString(),
      progress: 100
    });
  }

  if (currentStreak >= 7) {
    achievements.push({
      id: 'week_streak',
      name: 'Dedicated Learner',
      description: '7-day streak',
      icon: '🔥',
      unlockedAt: new Date().toISOString(),
      progress: 100
    });
  }

  if (wordsLearned.size >= 100) {
    achievements.push({
      id: 'vocabulary_100',
      name: 'Word Collector',
      description: 'Learn 100 words',
      icon: '📚',
      unlockedAt: new Date().toISOString(),
      progress: 100
    });
  }

  return {
    userId,
    totalWordsLearned: wordsLearned.size,
    totalPracticeMinutes,
    currentStreak,
    longestStreak,
    lastPracticeDate: progressData[0]?.createdAt || new Date().toISOString(),
    fluencyLevel,
    achievements,
    vocabularyMastery
  };
}

/**
 * Calculates detailed progress statistics
 */
function calculateProgressStats(progressData: any[]): any {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const filterByTimeRange = (data: any[], startDate: Date) => {
    return data.filter(item => new Date(item.createdAt) >= startDate);
  };

  const calculateStats = (data: any[]) => {
    const practiceMinutes = data
      .filter(item => item.action === 'practice_session')
      .reduce((sum, item) => sum + (item.data?.duration || 0), 0);

    const wordsLearned = new Set(
      data
        .filter(item => item.action === 'word_learned')
        .map(item => item.data?.word)
        .filter(Boolean)
    ).size;

    const messagesCount = data.filter(item => item.action === 'chat_message').length;

    return { practiceMinutes, wordsLearned, messagesCount };
  };

  return {
    daily: calculateStats(filterByTimeRange(progressData, dayAgo)),
    weekly: calculateStats(filterByTimeRange(progressData, weekAgo)),
    monthly: calculateStats(filterByTimeRange(progressData, monthAgo)),
    allTime: calculateStats(progressData)
  };
}

/**
 * Handles GET /progress/dashboard
 */
async function handleGetDashboard(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const progressData = await getUserProgressData(userId);
    const dashboard = calculateProgressDashboard(progressData);
    
    return jsonResponse(200, dashboard);
  } catch (error) {
    console.error('Error getting dashboard:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles GET /progress/stats
 */
async function handleGetStats(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const progressData = await getUserProgressData(userId);
    const stats = calculateProgressStats(progressData);
    
    return jsonResponse(200, stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles GET /progress/vocabulary
 */
async function handleGetVocabulary(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const progressData = await getUserProgressData(userId);
    const wordData = progressData.filter(item => item.action === 'word_learned');
    
    const vocabulary = wordData.map(item => ({
      word: item.data?.word || '',
      translation: item.data?.translation || '',
      firstSeen: item.createdAt,
      lastPracticed: item.createdAt,
      masteryLevel: 1,
      timesCorrect: 1,
      timesIncorrect: 0
    }));
    
    return jsonResponse(200, vocabulary);
  } catch (error) {
    console.error('Error getting vocabulary:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles GET /progress/achievements
 */
async function handleGetAchievements(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const progressData = await getUserProgressData(userId);
    const dashboard = calculateProgressDashboard(progressData);
    
    return jsonResponse(200, dashboard.achievements);
  } catch (error) {
    console.error('Error getting achievements:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles GET /progress/streak
 */
async function handleGetStreak(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const progressData = await getUserProgressData(userId);
    const dashboard = calculateProgressDashboard(progressData);
    
    return jsonResponse(200, {
      current: dashboard.currentStreak,
      longest: dashboard.longestStreak
    });
  } catch (error) {
    console.error('Error getting streak:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles POST /progress/practice-session
 */
async function handleRecordPracticeSession(userId: string, body: any): Promise<APIGatewayProxyResult> {
  try {
    const { mode, duration } = body;
    
    if (!mode || typeof duration !== 'number') {
      return jsonResponse(400, { error: 'Mode and duration are required' });
    }

    await recordUserProgress(userId, 'practice_session', {
      mode,
      duration,
      timestamp: new Date().toISOString()
    });

    return jsonResponse(201, { message: 'Practice session recorded' });
  } catch (error) {
    console.error('Error recording practice session:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles POST /progress/word-learned
 */
async function handleRecordWordLearned(userId: string, body: any): Promise<APIGatewayProxyResult> {
  try {
    const { word, translation } = body;
    
    if (!word || !translation) {
      return jsonResponse(400, { error: 'Word and translation are required' });
    }

    await recordUserProgress(userId, 'word_learned', {
      word,
      translation,
      timestamp: new Date().toISOString()
    });

    return jsonResponse(201, { message: 'Word learned recorded' });
  } catch (error) {
    console.error('Error recording word learned:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles POST /progress/chat-message
 */
async function handleRecordChatMessage(userId: string, body: any): Promise<APIGatewayProxyResult> {
  try {
    const { message, response } = body;
    
    if (!message || !response) {
      return jsonResponse(400, { error: 'Message and response are required' });
    }

    await recordUserProgress(userId, 'chat_message', {
      message,
      response,
      timestamp: new Date().toISOString()
    });

    return jsonResponse(201, { message: 'Chat message recorded' });
  } catch (error) {
    console.error('Error recording chat message:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Main Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[handler] Received event:', JSON.stringify(event, null, 2));
  console.log('[handler] HTTP Method:', event.httpMethod);
  console.log('[handler] Path:', event.path);

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return jsonResponse(200, {});
    }

    // All endpoints require authentication
    const userId = extractUserIdFromToken(event);
    if (!userId) {
      return jsonResponse(401, { error: 'Authentication required' });
    }

    const body = event.body ? JSON.parse(event.body) : {};

    // Handle GET endpoints
    if (event.httpMethod === 'GET') {
      if (event.path === '/progress/dashboard') {
        return await handleGetDashboard(userId);
      }
      
      if (event.path === '/progress/stats') {
        return await handleGetStats(userId);
      }
      
      if (event.path === '/progress/vocabulary') {
        return await handleGetVocabulary(userId);
      }
      
      if (event.path === '/progress/achievements') {
        return await handleGetAchievements(userId);
      }
      
      if (event.path === '/progress/streak') {
        return await handleGetStreak(userId);
      }
    }

    // Handle POST endpoints
    if (event.httpMethod === 'POST') {
      if (event.path === '/progress/practice-session') {
        return await handleRecordPracticeSession(userId, body);
      }
      
      if (event.path === '/progress/word-learned') {
        return await handleRecordWordLearned(userId, body);
      }
      
      if (event.path === '/progress/chat-message') {
        return await handleRecordChatMessage(userId, body);
      }
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (error) {
    console.error('[handler] Error:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};