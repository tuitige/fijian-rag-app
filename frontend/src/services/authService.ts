import api from './api';
import { LoginCredentials, SignupCredentials, AuthResponse, User, ForgotPasswordRequest, ResetPasswordRequest } from '../types/auth';
import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { COGNITO_CONFIG, COGNITO_HOSTED_UI } from '../config/cognito';

class AuthService {
  private userPool: CognitoUserPool;

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      ClientId: COGNITO_CONFIG.clientId,
    });
  }

  // ===== Cognito Hosted UI Methods =====

  /**
   * Redirects to Cognito Hosted UI for authentication
   */
  redirectToLogin(): void {
    window.location.href = COGNITO_HOSTED_UI.signInUrl;
  }

  /**
   * Redirects to Cognito logout and clears local tokens
   */
  redirectToLogout(): void {
    this.clearLocalTokens();
    window.location.href = COGNITO_HOSTED_UI.signOutUrl;
  }

  /**
   * Parses tokens from URL hash after Cognito redirect
   * Returns the id_token if found, null otherwise
   */
  parseTokenFromUrl(): string | null {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const idToken = params.get('id_token');
    const accessToken = params.get('access_token');
    const error = params.get('error');

    if (error) {
      console.error('Cognito authentication error:', error);
      throw new Error(`Authentication failed: ${error}`);
    }

    if (idToken) {
      // Store tokens in localStorage
      localStorage.setItem('cognitoIdToken', idToken);
      if (accessToken) {
        localStorage.setItem('cognitoAccessToken', accessToken);
      }
      
      // Clear the URL hash
      window.history.replaceState(null, '', window.location.pathname);
      
      return idToken;
    }

    return null;
  }

  /**
   * Gets the current Cognito ID token from localStorage
   */
  getCognitoIdToken(): string | null {
    return localStorage.getItem('cognitoIdToken');
  }

  /**
   * Gets the current Cognito access token from localStorage  
   */
  getCognitoAccessToken(): string | null {
    return localStorage.getItem('cognitoAccessToken');
  }

  /**
   * Checks if user is authenticated via Cognito
   */
  isCognitoAuthenticated(): boolean {
    const idToken = this.getCognitoIdToken();
    if (!idToken) return false;
    
    return !this.isTokenExpired(idToken);
  }

  /**
   * Gets user info from Cognito ID token
   */
  getCognitoUserInfo(): User | null {
    const idToken = this.getCognitoIdToken();
    if (!idToken) return null;

    try {
      const payload = this.getTokenPayload(idToken);
      return {
        id: payload.sub,
        email: payload.email,
        username: payload['cognito:username'] || payload.preferred_username || payload.email,
        createdAt: new Date(payload.iat * 1000),
        preferences: {
          learningGoal: 'casual',
          dailyGoalMinutes: 15,
          notificationsEnabled: true,
        }
      };
    } catch (error) {
      console.error('Error parsing Cognito user info:', error);
      return null;
    }
  }

  /**
   * Clears all stored Cognito tokens
   */
  clearLocalTokens(): void {
    localStorage.removeItem('cognitoIdToken');
    localStorage.removeItem('cognitoAccessToken');
    // Also clear legacy tokens
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }

  // ===== Legacy API Methods (maintained for compatibility) =====
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  }

  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    const response = await api.post('/auth/signup', credentials);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Logout on client side even if server call fails
      console.error('Logout error:', error);
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/user/profile');
    return response.data;
  }

  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    await api.post('/auth/forgot-password', request);
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    await api.post('/auth/reset-password', request);
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await api.put('/user/profile', updates);
    return response.data;
  }

  async deleteAccount(): Promise<void> {
    await api.delete('/user/profile');
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Date.now() / 1000;
      return payload.exp < now;
    } catch (error) {
      return true;
    }
  }

  getTokenPayload(token: string): any {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
      return null;
    }
  }
}

export const authService = new AuthService();