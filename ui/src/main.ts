import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Amplify } from 'aws-amplify';
import { AppModule } from './app/app.module';
import config from '../amplify/amplify_outputs.json';

Amplify.configure(config);

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
