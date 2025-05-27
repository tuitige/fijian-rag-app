import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { HomeComponent } from './pages/home/home.component';

import { AuthModule } from 'angular-auth-oidc-client';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
        AuthModule.forRoot({
      config: {
        authority: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_shE3zxrwp',
        redirectUrl: 'https://fijian-ai.org/',
        postLogoutRedirectUri: 'https://fijian-ai.org/',
        clientId: '6c1anji9n56kt4bmqtp2a0c8kb',
        scope: 'openid profile email',
        responseType: 'code',
        silentRenew: true,
        renewTimeBeforeTokenExpiresInSeconds: 60,
        useRefreshToken: true
      }
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {




}
