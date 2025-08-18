import React, { ReactNode } from 'react';
import './AuthLayout.css';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        </div>
        <div className="auth-content">
          {children}
        </div>
        <div className="auth-footer">
          <p className="auth-footer-text">
            Learning Fijian has never been easier
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;