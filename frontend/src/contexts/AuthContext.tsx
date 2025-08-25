import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { /*User,*/ AuthState, LoginCredentials, SignupCredentials } from '../types/auth';
import { authService } from '../services/authService';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  // Cognito-specific methods
  loginWithCognito: () => void;
  logoutFromCognito: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Check for existing auth token on app startup
    const checkAuthStatus = async () => {
      try {
        // First check for Cognito token from URL hash (after redirect)
        const tokenFromUrl = authService.parseTokenFromUrl();
        if (tokenFromUrl) {
          const user = authService.getCognitoUserInfo();
          if (user) {
            setAuthState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return;
          }
        }

        // Check for existing Cognito authentication
        if (authService.isCognitoAuthenticated()) {
          const user = authService.getCognitoUserInfo();
          if (user) {
            setAuthState({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return;
          }
        }

        // Fallback to legacy token check
        const token = localStorage.getItem('authToken');
        if (token) {
          const user = await authService.getCurrentUser();
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        authService.clearLocalTokens();
        setAuthState(prev => ({ 
          ...prev, 
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication check failed'
        }));
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      const { user, token, refreshToken } = await authService.login(credentials);
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('refreshToken', refreshToken);
      
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed',
      }));
      throw error;
    }
  };

  const signup = async (credentials: SignupCredentials): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      const { user, token, refreshToken } = await authService.signup(credentials);
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('refreshToken', refreshToken);
      
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Signup failed',
      }));
      throw error;
    }
  };

  const logout = (): void => {
    authService.clearLocalTokens();
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  const loginWithCognito = (): void => {
    setAuthState(prev => ({ ...prev, error: null }));
    authService.redirectToLogin();
  };

  const logoutFromCognito = (): void => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    authService.redirectToLogout();
  };

  const clearError = (): void => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const value: AuthContextType = {
    ...authState,
    login,
    signup,
    logout,
    clearError,
    loginWithCognito,
    logoutFromCognito,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};