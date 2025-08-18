import api from './api';
import { LoginCredentials, SignupCredentials, AuthResponse, User, ForgotPasswordRequest, ResetPasswordRequest } from '../types/auth';

class AuthService {
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