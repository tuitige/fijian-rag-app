// Auth Testing Utilities for Login Flow Validation
import { COGNITO_CONFIG, COGNITO_HOSTED_UI } from '../config/cognito';

/**
 * Validates the Cognito configuration and login URLs
 * This function can be used for manual testing and validation
 */
export const validateCognitoConfig = () => {
  console.group('🔍 Cognito Configuration Validation');
  
  console.log('🏢 Region:', COGNITO_CONFIG.region);
  console.log('🔑 User Pool ID:', COGNITO_CONFIG.userPoolId);
  console.log('📱 Client ID:', COGNITO_CONFIG.clientId);
  console.log('🌐 Domain:', COGNITO_CONFIG.domain);
  
  console.group('🔗 Generated URLs');
  console.log('📥 Sign In URL:', COGNITO_HOSTED_UI.signInUrl);
  console.log('📤 Sign Out URL:', COGNITO_HOSTED_UI.signOutUrl);
  console.groupEnd();
  
  // Validate domain format
  const isDomainCorrect = COGNITO_CONFIG.domain === 'auth.fijian-ai.org';
  console.log(
    `✅ Domain Validation:`, 
    isDomainCorrect ? 'PASS - Using custom domain' : 'FAIL - Using AWS domain'
  );
  
  // Validate URL structure
  const signInUrl = new URL(COGNITO_HOSTED_UI.signInUrl);
  console.log('🔍 URL Analysis:');
  console.log('  - Protocol:', signInUrl.protocol);
  console.log('  - Host:', signInUrl.host);
  console.log('  - Pathname:', signInUrl.pathname);
  console.log('  - Search Params:', Object.fromEntries(signInUrl.searchParams));
  
  console.groupEnd();
  
  return {
    isDomainCorrect,
    config: COGNITO_CONFIG,
    urls: COGNITO_HOSTED_UI,
    signInUrlParts: {
      protocol: signInUrl.protocol,
      host: signInUrl.host,
      pathname: signInUrl.pathname,
      searchParams: Object.fromEntries(signInUrl.searchParams)
    }
  };
};

/**
 * Simulates token parsing from a redirect URL
 * Useful for testing the token exchange flow
 */
export const simulateTokenRedirect = (mockUrl: string) => {
  console.group('🔄 Simulating Token Redirect');
  console.log('📥 Mock URL:', mockUrl);
  
  const url = new URL(mockUrl);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');
  
  console.log('🎫 Authorization Code:', code ? `${code.substring(0, 20)}...` : 'None');
  console.log('❌ Error:', error || 'None');
  console.log('🔐 State:', state || 'None');
  
  console.groupEnd();
  
  return { code, error, state };
};

/**
 * Validates environment variables related to Cognito
 */
export const validateEnvironmentVariables = () => {
  console.group('🌍 Environment Variables Check');
  
  const envVars = {
    REACT_APP_COGNITO_CLIENT_ID: process.env.REACT_APP_COGNITO_CLIENT_ID,
    REACT_APP_COGNITO_DOMAIN: process.env.REACT_APP_COGNITO_DOMAIN,
    REACT_APP_REDIRECT_URI: process.env.REACT_APP_REDIRECT_URI,
    NODE_ENV: process.env.NODE_ENV
  };
  
  Object.entries(envVars).forEach(([key, value]) => {
    console.log(`${key}:`, value || '(using default)');
  });
  
  console.groupEnd();
  
  return envVars;
};