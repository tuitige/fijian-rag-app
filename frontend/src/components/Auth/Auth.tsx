import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

type AuthMode = 'login' | 'signup' | 'forgot-password';

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');

  const switchToLogin = () => setMode('login');
  const switchToSignup = () => setMode('signup');
  const switchToForgotPassword = () => setMode('forgot-password');

  switch (mode) {
    case 'signup':
      return <SignupForm onSwitchToLogin={switchToLogin} />;
    case 'forgot-password':
      // TODO: Implement ForgotPassword component
      return <LoginForm onSwitchToSignup={switchToSignup} onSwitchToForgotPassword={switchToForgotPassword} />;
    case 'login':
    default:
      return <LoginForm onSwitchToSignup={switchToSignup} onSwitchToForgotPassword={switchToForgotPassword} />;
  }
};

export default Auth;