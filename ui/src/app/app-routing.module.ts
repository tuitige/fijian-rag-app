import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { VerificationReviewComponent } from './pages/verification-review/verification-review.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'verify', component: VerificationReviewComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
