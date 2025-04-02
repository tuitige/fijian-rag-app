import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Amplify } from 'aws-amplify';
import { AppModule } from './app/app.module';

// During build, Amplify will automatically inject the configuration
Amplify.configure({
  // Your config will be automatically injected by Amplify
});

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
