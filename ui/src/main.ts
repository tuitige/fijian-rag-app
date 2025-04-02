import { bootstrapApplication } from '@angular/platform-browser';
import { Amplify } from 'aws-amplify';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

Amplify.configure({
  Auth: {
    region: 'us-west-2',
    userPoolId: 'us-west-2_shE3zxrwp',
    userPoolWebClientId: '6c1anji9n56kt4bmqtp2a0c8kb'
  }
});

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
