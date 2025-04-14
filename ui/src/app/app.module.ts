import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';     

@NgModule({
  imports: [
    BrowserModule,
    AmplifyAuthenticatorModule,
    FormsModule,
    AppComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
