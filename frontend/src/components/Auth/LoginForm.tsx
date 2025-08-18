import React, { useState } from 'react';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../contexts/AuthContext';
import { LoginCredentials } from '../../types/auth';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onSwitchToForgotPassword: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToSignup, onSwitchToForgotPassword }) => {
  const { login, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<LoginCredentials>>({});

  const validateForm = (): boolean => {
    const errors: Partial<LoginCredentials> = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    try {
      await login(formData);
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear field error when user starts typing
    if (formErrors[name as keyof LoginCredentials]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Sign in to continue your Fijian learning journey"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`form-input ${formErrors.email ? 'error' : ''}`}
            placeholder="Enter your email"
            disabled={isLoading}
          />
          {formErrors.email && (
            <div className="form-error">{formErrors.email}</div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={`form-input ${formErrors.password ? 'error' : ''}`}
            placeholder="Enter your password"
            disabled={isLoading}
          />
          {formErrors.password && (
            <div className="form-error">{formErrors.password}</div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading && <span className="loading-spinner" />}
          Sign In
        </button>

        <div className="auth-link">
          <button
            type="button"
            onClick={onSwitchToForgotPassword}
            className="btn btn-secondary"
            style={{ background: 'transparent', border: 'none', padding: 0, color: '#667eea' }}
          >
            Forgot your password?
          </button>
        </div>

        <div className="auth-link">
          <span>Don't have an account? </span>
          <button
            type="button"
            onClick={onSwitchToSignup}
            style={{ background: 'transparent', border: 'none', padding: 0, color: '#667eea', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Sign up
          </button>
        </div>
      </form>
    </AuthLayout>
  );
};

export default LoginForm;