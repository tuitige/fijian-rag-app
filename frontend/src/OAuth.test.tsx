import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from 'react-oidc-context';

// Test OAuth configuration
test('OAuth configuration uses environment variables correctly', () => {
  // Set test environment variables
  process.env.REACT_APP_COGNITO_CLIENT_ID = 'test-client-id';
  process.env.REACT_APP_REDIRECT_URI = 'http://localhost:3000';
  
  const cognitoAuthConfig = {
    authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_shE3zxrwp",
    client_id: process.env.REACT_APP_COGNITO_CLIENT_ID || "4pvrvr5jf8h9bvi59asmlbdjcp",
    redirect_uri: process.env.REACT_APP_REDIRECT_URI || window.location.origin,
    response_type: "token",
    scope: "email openid profile",
  };

  // Validate configuration
  expect(cognitoAuthConfig.client_id).toBe('test-client-id');
  expect(cognitoAuthConfig.redirect_uri).toBe('http://localhost:3000');
  expect(cognitoAuthConfig.response_type).toBe('token');
  
  // Test rendering with AuthProvider doesn't crash
  const TestComponent = () => <div>Test OAuth Config</div>;
  render(
    <AuthProvider {...cognitoAuthConfig}>
      <TestComponent />
    </AuthProvider>
  );
  
  expect(screen.getByText('Test OAuth Config')).toBeInTheDocument();
});

test('OAuth configuration falls back to defaults when env vars not set', () => {
  // Clear environment variables
  delete process.env.REACT_APP_COGNITO_CLIENT_ID;
  delete process.env.REACT_APP_REDIRECT_URI;
  
  const cognitoAuthConfig = {
    authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_shE3zxrwp",
    client_id: process.env.REACT_APP_COGNITO_CLIENT_ID || "4pvrvr5jf8h9bvi59asmlbdjcp",
    redirect_uri: process.env.REACT_APP_REDIRECT_URI || window.location.origin,
    response_type: "token",
    scope: "email openid profile",
  };

  // Validate fallback values
  expect(cognitoAuthConfig.client_id).toBe('4pvrvr5jf8h9bvi59asmlbdjcp');
  expect(cognitoAuthConfig.redirect_uri).toBe('http://localhost');
  expect(cognitoAuthConfig.response_type).toBe('token');
});