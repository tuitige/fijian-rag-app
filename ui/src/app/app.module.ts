import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms'; // ✅ THIS IS REQUIRED
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './pages/home/home.component';
import { VerificationReviewComponent } from './pages/verification-review/verification-review.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    VerificationReviewComponent
  ],
  imports: [
    BrowserModule,
    FormsModule, // ✅ This enables [(ngModel)]
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
