import axios, { AxiosResponse } from 'axios';
import { ApiError } from '../types/api';

// Configure axios defaults
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
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