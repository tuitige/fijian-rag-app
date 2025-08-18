# Auth Lambda Function

This directory contains authentication and authorization functionality for the Fijian RAG MVP.

## Status: ✅ Implemented

## Features

### Authentication Endpoints
- `POST /auth/signup` - User registration with email verification
- `POST /auth/login` - User authentication with JWT tokens
- `POST /auth/logout` - User logout (client-side token removal)
- `POST /auth/refresh` - JWT token refresh
- `POST /auth/forgot-password` - Password reset request (planned)
- `POST /auth/reset-password` - Password reset (planned)

### User Management Endpoints
- `GET /user/profile` - Get user profile information
- `PUT /user/profile` - Update user profile and preferences
- `DELETE /user/profile` - Delete user account (planned)

## Security Features

- **Password Security**: bcrypt hashing with salt rounds (12)
- **JWT Tokens**: Secure token-based authentication
- **Token Refresh**: Automatic token refresh mechanism
- **Input Validation**: Email, username, and password validation
- **CORS Support**: Cross-origin resource sharing headers

## Database Schema

### Users Table
```typescript
interface User {
  id: string;              // UUID primary key
  email: string;           // User email (unique)
  username: string;        // Display name
  password: string;        // bcrypt hashed password
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
  preferences: {
    learningGoal: 'casual' | 'conversational' | 'fluent';
    dailyGoalMinutes: number;
    notificationsEnabled: boolean;
    preferredLearningTime?: string;
  };
}
```

## Environment Variables

- `USERS_TABLE` - DynamoDB table name for users
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_REFRESH_SECRET` - Secret key for refresh token signing

## Usage

The auth lambda integrates with the frontend authentication system to provide secure user management and session handling for the Fijian language learning app.