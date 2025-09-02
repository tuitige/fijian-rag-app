import axios, { AxiosResponse } from 'axios';
import { ApiError } from '../types/api';

// Configure axios defaults
const rawApiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://0wujtxlvc0.execute-api.us-west-2.amazonaws.com/dev';

// For now, always use the direct API Gateway URL since we only have one environment
// TODO: Once CloudFront routing for /api/* is verified to work with fijian-ai.org, 
// we can enable the production domain logic
const apiBaseUrl = rawApiBaseUrl.endsWith('/') ? rawApiBaseUrl.slice(0, -1) : rawApiBaseUrl;

console.log('🔧 API Base URL:', apiBaseUrl);

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth headers
api.interceptors.request.use(
  (config) => {
    console.log('🚀 API Request:', (config.baseURL || '') + (config.url || ''));
    
    // For API Gateway Cognito authorization, use ID token (not access token)
    // API Gateway Cognito User Pool authorizers require ID tokens for authentication
    const cognitoIdToken = localStorage.getItem('cognitoIdToken');
    const cognitoAccessToken = localStorage.getItem('cognitoAccessToken');
    const legacyToken = localStorage.getItem('authToken');
    
    const token = cognitoIdToken || cognitoAccessToken || legacyToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    console.error('API Error:', error);
    
    // Handle 401 Unauthorized errors - likely due to expired token
    if (error.response?.status === 401) {
      console.warn('🔒 401 Unauthorized - Token may be expired. Clearing authentication tokens.');
      
      // Clear expired tokens
      localStorage.removeItem('cognitoIdToken');
      localStorage.removeItem('cognitoAccessToken');
      localStorage.removeItem('authToken'); // legacy token
      
      // Return a specific error for 401 to help users understand they need to re-authenticate
      return Promise.reject({
        error: 'Authentication expired',
        message: 'Your session has expired. Please sign in again to continue.',
        statusCode: 401,
        requiresReauth: true
      } as ApiError & { requiresReauth: boolean });
    }
    
    if (error.response?.data) {
      // Server responded with error
      return Promise.reject(error.response.data as ApiError);
    } else if (error.request) {
      // Network error
      return Promise.reject({
        error: 'Network error',
        message: 'Unable to connect to the server. Please check your internet connection.',
      } as ApiError);
    } else {
      // Other error
      return Promise.reject({
        error: 'Request failed',
        message: error.message || 'An unexpected error occurred.',
      } as ApiError);
    }
  }
);

export default api;