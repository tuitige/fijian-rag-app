import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './CognitoAuth.css';

const CognitoAuth: React.FC = () => {
  const { isAuthenticated, user, loginWithCognito, logoutFromCognito, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="cognito-auth loading">
        <div className="spinner"></div>
        <span>Checking authentication...</span>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="cognito-auth authenticated">
        <div className="user-info">
          <span className="welcome-text">Welcome, {user.username}!</span>
          <span className="user-email">{user.email}</span>
        </div>
        <button 
          onClick={logoutFromCognito}
          className="btn btn-secondary logout-btn"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="cognito-auth unauthenticated">
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      <div className="login-prompt">
        <h3>Welcome to Fijian RAG App</h3>
        <p>Please sign in to access your personalized learning experience.</p>
        <button 
          onClick={loginWithCognito}
          className="btn btn-primary login-btn"
        >
          Sign In with AWS Cognito
        </button>
      </div>
    </div>
  );
};

export default CognitoAuth;