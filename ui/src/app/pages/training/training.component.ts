// src/app/pages/training/training.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container mx-auto p-4">
      <h2>Training Page</h2>
      <!-- Add your training page content here -->
    </div>
  `
})
export class TrainingComponent {}
