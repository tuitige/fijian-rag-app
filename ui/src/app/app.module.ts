import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { AppComponent } from './app.component';

@NgModule({
  imports: [
    BrowserModule,
    AmplifyAuthenticatorModule,
    AppComponent  // Move it to imports since it's standalone
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
