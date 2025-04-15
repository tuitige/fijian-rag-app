import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TrainingComponent } from './pages/training/training.component';
import { VerifyModuleComponent } from './pages/verify-module/verify-module.component';

const routes: Routes = [
  { path: '', redirectTo: '/training', pathMatch: 'full' },
  { path: 'training', component: TrainingComponent },
  { path: 'verify-module/:title', component: VerifyModuleComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }