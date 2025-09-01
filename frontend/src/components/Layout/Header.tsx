import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthButton from '../Auth/AuthButton';

const Header: React.FC = () => {
  const location = useLocation();

  return (
    <header style={{
      backgroundColor: 'var(--color-surface-elevated)',
      borderBottom: '1px solid var(--color-border)',
      padding: 'var(--spacing-md) 0',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
            <h1 style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-primary)'
            }}>
              🇫🇯 Fijian AI Chat
            </h1>
            
            <nav>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <Link 
                  to="/" 
                  style={{
                    textDecoration: 'none',
                    color: location.pathname === '/' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: location.pathname === '/' ? 'var(--font-weight-semibold)' : 'normal',
                    fontSize: 'var(--font-size-sm)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: location.pathname === '/' ? 'var(--color-primary-light)' : 'transparent',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Chat & Learning
                </Link>
                <Link 
                  to="/vocabulary-management" 
                  style={{
                    textDecoration: 'none',
                    color: location.pathname === '/vocabulary-management' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: location.pathname === '/vocabulary-management' ? 'var(--font-weight-semibold)' : 'normal',
                    fontSize: 'var(--font-size-sm)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: location.pathname === '/vocabulary-management' ? 'var(--color-primary-light)' : 'transparent',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Data Management
                </Link>
              </div>
            </nav>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)'
          }}>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}>
              Learn Fijian with AI
            </div>
            <AuthButton />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;