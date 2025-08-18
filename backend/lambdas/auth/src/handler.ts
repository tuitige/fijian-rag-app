/**
 * Fijian RAG App - Authentication Handler
 * 
 * This Lambda function handles:
 * 1. POST /auth/signup - User registration
 * 2. POST /auth/login - User authentication
 * 3. POST /auth/logout - User logout
 * 4. POST /auth/refresh - Token refresh
 * 5. POST /auth/forgot-password - Password reset request
 * 6. POST /auth/reset-password - Password reset
 * 7. GET /user/profile - Get user profile
 * 8. PUT /user/profile - Update user profile
 * 9. DELETE /user/profile - Delete user account
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Configuration constants
const USERS_TABLE = process.env.USERS_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

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
 * Validates email format
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength
 */
function validatePassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

/**
 * Validates username format
 */
function validateUsername(username: string): boolean {
  // 3-20 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Generates JWT tokens
 */
function generateTokens(userId: string, email: string): { token: string; refreshToken: string } {
  const payload = { userId, email };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  
  return { token, refreshToken };
}

/**
 * Verifies JWT token
 */
function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verifies refresh token
 */
function verifyRefreshToken(token: string): any {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Gets user by email
 */
async function getUserByEmail(email: string): Promise<any | null> {
  try {
    // In a real implementation, you'd use a GSI on email
    // For now, we'll scan (not recommended for production)
    const params = {
      TableName: USERS_TABLE,
      Key: marshall({ email })
    };

    const result = await ddbClient.send(new GetItemCommand(params));
    return result.Item ? unmarshall(result.Item) : null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

/**
 * Gets user by ID
 */
async function getUserById(userId: string): Promise<any | null> {
  try {
    const params = {
      TableName: USERS_TABLE,
      Key: marshall({ id: userId })
    };

    const result = await ddbClient.send(new GetItemCommand(params));
    return result.Item ? unmarshall(result.Item) : null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Creates a new user
 */
async function createUser(email: string, username: string, hashedPassword: string): Promise<any> {
  const userId = uuidv4();
  const now = new Date().toISOString();
  
  const user = {
    id: userId,
    email,
    username,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
    preferences: {
      learningGoal: 'casual',
      dailyGoalMinutes: 30,
      notificationsEnabled: true
    }
  };

  const params = {
    TableName: USERS_TABLE,
    Item: marshall(user),
    ConditionExpression: 'attribute_not_exists(email)'
  };

  await ddbClient.send(new PutItemCommand(params));
  
  // Remove password from response
  const { password, ...userResponse } = user;
  return userResponse;
}

/**
 * Handles user signup
 */
async function handleSignup(body: any): Promise<APIGatewayProxyResult> {
  const { email, username, password, confirmPassword } = body;

  // Validate input
  if (!email || !username || !password || !confirmPassword) {
    return jsonResponse(400, { error: 'Missing required fields' });
  }

  if (!validateEmail(email)) {
    return jsonResponse(400, { error: 'Invalid email format' });
  }

  if (!validateUsername(username)) {
    return jsonResponse(400, { error: 'Username must be 3-20 characters, alphanumeric and underscores only' });
  }

  if (!validatePassword(password)) {
    return jsonResponse(400, { error: 'Password must be at least 8 characters with uppercase, lowercase, and number' });
  }

  if (password !== confirmPassword) {
    return jsonResponse(400, { error: 'Passwords do not match' });
  }

  try {
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return jsonResponse(409, { error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await createUser(email, username, hashedPassword);

    // Generate tokens
    const { token, refreshToken } = generateTokens(user.id, user.email);

    return jsonResponse(201, {
      user,
      token,
      refreshToken
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    if (error.name === 'ConditionalCheckFailedException') {
      return jsonResponse(409, { error: 'User already exists' });
    }
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles user login
 */
async function handleLogin(body: any): Promise<APIGatewayProxyResult> {
  const { email, password } = body;

  if (!email || !password) {
    return jsonResponse(400, { error: 'Email and password are required' });
  }

  try {
    // Get user
    const user = await getUserByEmail(email);
    if (!user) {
      return jsonResponse(401, { error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return jsonResponse(401, { error: 'Invalid credentials' });
    }

    // Generate tokens
    const { token, refreshToken } = generateTokens(user.id, user.email);

    // Remove password from response
    const { password: _, ...userResponse } = user;

    return jsonResponse(200, {
      user: userResponse,
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles token refresh
 */
async function handleRefresh(body: any): Promise<APIGatewayProxyResult> {
  const { refreshToken } = body;

  if (!refreshToken) {
    return jsonResponse(400, { error: 'Refresh token is required' });
  }

  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user to ensure they still exist
    const user = await getUserById(decoded.userId);
    if (!user) {
      return jsonResponse(401, { error: 'User not found' });
    }

    // Generate new tokens
    const tokens = generateTokens(user.id, user.email);

    return jsonResponse(200, tokens);
  } catch (error) {
    console.error('Token refresh error:', error);
    return jsonResponse(401, { error: 'Invalid refresh token' });
  }
}

/**
 * Handles get user profile
 */
async function handleGetProfile(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    // Remove password from response
    const { password, ...userResponse } = user;
    return jsonResponse(200, userResponse);
  } catch (error) {
    console.error('Get profile error:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Handles update user profile
 */
async function handleUpdateProfile(userId: string, body: any): Promise<APIGatewayProxyResult> {
  const { username, preferences } = body;

  try {
    const updateExpression = [];
    const expressionAttributeNames: any = {};
    const expressionAttributeValues: any = {};

    if (username) {
      if (!validateUsername(username)) {
        return jsonResponse(400, { error: 'Invalid username format' });
      }
      updateExpression.push('#username = :username');
      expressionAttributeNames['#username'] = 'username';
      expressionAttributeValues[':username'] = username;
    }

    if (preferences) {
      updateExpression.push('#preferences = :preferences');
      expressionAttributeNames['#preferences'] = 'preferences';
      expressionAttributeValues[':preferences'] = preferences;
    }

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const params = {
      TableName: USERS_TABLE,
      Key: marshall({ id: userId }),
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      ReturnValues: 'ALL_NEW'
    };

    const result = await ddbClient.send(new UpdateItemCommand(params));
    
    if (!result.Attributes) {
      return jsonResponse(404, { error: 'User not found' });
    }

    const updatedUser = unmarshall(result.Attributes);
    const { password, ...userResponse } = updatedUser;

    return jsonResponse(200, userResponse);
  } catch (error) {
    console.error('Update profile error:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * Extracts user ID from Authorization header
 */
function extractUserIdFromToken(event: APIGatewayProxyEvent): string | null {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    return decoded.userId;
  } catch (error) {
    return null;
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

    const body = event.body ? JSON.parse(event.body) : {};

    // Public endpoints (no authentication required)
    if (event.httpMethod === 'POST' && event.path === '/auth/signup') {
      return await handleSignup(body);
    }

    if (event.httpMethod === 'POST' && event.path === '/auth/login') {
      return await handleLogin(body);
    }

    if (event.httpMethod === 'POST' && event.path === '/auth/refresh') {
      return await handleRefresh(body);
    }

    if (event.httpMethod === 'POST' && event.path === '/auth/logout') {
      // For JWT, logout is handled client-side by removing the token
      return jsonResponse(200, { message: 'Logged out successfully' });
    }

    // Protected endpoints (authentication required)
    const userId = extractUserIdFromToken(event);
    if (!userId) {
      return jsonResponse(401, { error: 'Authentication required' });
    }

    if (event.httpMethod === 'GET' && event.path === '/user/profile') {
      return await handleGetProfile(userId);
    }

    if (event.httpMethod === 'PUT' && event.path === '/user/profile') {
      return await handleUpdateProfile(userId, body);
    }

    if (event.httpMethod === 'DELETE' && event.path === '/user/profile') {
      // TODO: Implement account deletion
      return jsonResponse(501, { error: 'Not implemented' });
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (error) {
    console.error('[handler] Error:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};