// Cognito configuration
export const COGNITO_CONFIG = {
  region: 'us-west-2',
  userPoolId: 'us-west-2_shE3zxrwp',
  // Note: These would need to be configured in the CDK stack
  // For now, using placeholder values that will need to be replaced
  clientId: process.env.REACT_APP_COGNITO_CLIENT_ID || 'placeholder-client-id',
  domain: process.env.REACT_APP_COGNITO_DOMAIN || 'fijian-auth.us-west-2.auth.amazonaws.com',
};

export const COGNITO_HOSTED_UI = {
  signInUrl: `https://${COGNITO_CONFIG.domain}/login?client_id=${COGNITO_CONFIG.clientId}&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(window.location.origin)}`,
  signOutUrl: `https://${COGNITO_CONFIG.domain}/logout?client_id=${COGNITO_CONFIG.clientId}&logout_uri=${encodeURIComponent(window.location.origin)}`,
};