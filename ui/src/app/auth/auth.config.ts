import { PassedInitialConfig } from 'angular-auth-oidc-client';

export const authConfig: PassedInitialConfig = {
  config: {
    authority: 'https://auth.fijian-ai.org',
    redirectUrl: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    clientId: '4pvrvr5jf8h9bvi59asmlbdjcp',
    scope: 'openid profile email',
    responseType: 'code',
    silentRenew: true,
    renewTimeBeforeTokenExpiresInSeconds: 60,
    useRefreshToken: true
  }
}
