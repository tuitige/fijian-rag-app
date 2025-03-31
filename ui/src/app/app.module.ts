import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';

@NgModule({
  imports: [
    BrowserModule,
    AppComponent,
    RouterModule.forRoot([
      { path: '', redirectTo: '/home', pathMatch: 'full' },
      { path: 'home', component: AppComponent },
      { path: 'training', loadComponent: () => 
        import('./pages/training/training.component').then(m => m.TrainingComponent) },
      { path: 'learning', loadComponent: () => 
        import('./pages/learning/learning.component').then(m => m.LearningComponent) },
      { path: 'about', loadComponent: () => 
        import('./pages/about/about.component').then(m => m.AboutComponent) }
    ])
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
