import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot([
      { path: '', redirectTo: '/home', pathMatch: 'full' },
      { path: 'training', loadChildren: () => import('./training/training.module').then(m => m.TrainingModule) },
      { path: 'learning', loadChildren: () => import('./learning/learning.module').then(m => m.LearningModule) },
      { path: 'about', loadChildren: () => import('./about/about.module').then(m => m.AboutModule) }
    ])
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
