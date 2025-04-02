import { Amplify } from 'aws-amplify';
import { AuthClass } from '@aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from '@aws-amplify/auth/cognito';

const auth = new AuthClass({
  tokenProvider: cognitoUserPoolsTokenProvider
});

Amplify.configure({
  Auth: {
    Cognito: {
    userPoolId: 'us-west-2_shE3zxrwp',
    userPoolWebClientId: '6c1anji9n56kt4bmqtp2a0c8kb',
      region: 'us-west-2'
    }
  }
});