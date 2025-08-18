# Progress Tracking Lambda Function

This directory contains progress tracking functionality for the Fijian RAG MVP.

## Status: ✅ Implemented

## Features

### Progress Endpoints
- `GET /progress/dashboard` - Get user progress dashboard data
- `GET /progress/stats` - Get detailed progress statistics (daily/weekly/monthly)
- `GET /progress/vocabulary` - Get user's vocabulary list with mastery levels
- `GET /progress/achievements` - Get user's unlocked achievements
- `GET /progress/streak` - Get user's current and longest learning streaks

### Activity Recording Endpoints
- `POST /progress/practice-session` - Record practice session duration
- `POST /progress/word-learned` - Record new vocabulary learned
- `POST /progress/chat-message` - Record chat interactions
- `POST /progress/vocabulary/:wordId/practice` - Record word practice attempts

## Progress Tracking Features

### Learning Metrics
- **Words Learned**: Automatic tracking of new vocabulary
- **Practice Time**: Session duration tracking
- **Learning Streaks**: Daily practice streak calculation
- **Fluency Level**: Progress-based fluency percentage
- **Chat Interactions**: Message count and conversation tracking

### Achievement System
- **First Steps**: Learn your first word
- **Dedicated Learner**: 7-day learning streak
- **Word Collector**: Learn 100 words
- **Translation Master**: Complete 100 translations
- **Conversationalist**: Have 50 conversations
- **Getting Fluent**: Reach 50% fluency level

### Progress Analytics
- **Daily Stats**: Practice minutes, words learned, messages sent
- **Weekly Trends**: 7-day rolling statistics
- **Monthly Overview**: 30-day progress summary
- **All-Time Totals**: Lifetime learning metrics

## Database Schema

### User Progress Table
```typescript
interface ProgressEntry {
  userId: string;          // Partition key
  timestamp: number;       // Sort key (Unix timestamp)
  action: string;          // Action type (chat_message, word_learned, practice_session)
  data: any;              // Action-specific data
  createdAt: string;      // ISO timestamp
}
```

### Action Types
- `chat_message`: Records chat interactions
- `word_learned`: Records new vocabulary acquisition
- `practice_session`: Records learning session duration
- `vocabulary_practice`: Records word practice attempts

## Calculations

### Streak Calculation
- Counts consecutive days with any learning activity
- Considers today and yesterday for current streak
- Tracks longest streak historically

### Fluency Level
- Based on vocabulary size (words learned / 100 * 100%)
- Maximum 100% fluency level
- Updates automatically with new vocabulary

### Achievement Progress
- Real-time achievement progress calculation
- Automatic unlocking based on milestones
- Progress tracking for incomplete achievements

## Environment Variables

- `USER_PROGRESS_TABLE` - DynamoDB table name for progress data
- `JWT_SECRET` - Secret key for JWT token verification

## Integration

The progress lambda integrates with:
- Chat system for automatic activity tracking
- Frontend progress dashboard for data visualization
- Achievement system for milestone tracking
- User authentication for secure data access