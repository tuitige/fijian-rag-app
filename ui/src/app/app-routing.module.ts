import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TrainingComponent } from './pages/training/training.component';
import { VerifyModuleComponent } from './pages/verify-module/verify-module.component';
import { PagesComponent } from './pages/pages/pages.component';

const routes: Routes = [
  { path: '', redirectTo: '/training', pathMatch: 'full' },
  { path: 'training', component: TrainingComponent },
  { path: 'verify-module/:title', component: VerifyModuleComponent },
  { path: 'pages/:title', component: PagesComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }