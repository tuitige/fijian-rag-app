import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'us-west-2',
    userPoolId: 'us-west-2_shE3zxrwp',
    userPoolWebClientId: '6c1anji9n56kt4bmqtp2a0c8kb'
  }
});
