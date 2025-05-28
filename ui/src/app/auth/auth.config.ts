import { PassedInitialConfig } from 'angular-auth-oidc-client';

export const authConfig: PassedInitialConfig = {
  config: {
    authority: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_shE3zxrwp',
    redirectUrl: 'https://fijian-ai.org',
    clientId: '4pvrvr5jf8h9bvi59asmlbdjcp',
    scope: 'email openid profile',
    responseType: 'code'
  };

}
