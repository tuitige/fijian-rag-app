import { Component } from '@angular/core';
import { HeaderComponent } from '../../components/header/header.component';

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './training.component.html'
})
export class TrainingComponent {}
