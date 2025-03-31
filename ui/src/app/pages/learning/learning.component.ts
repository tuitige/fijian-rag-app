// src/app/pages/learning/learning.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-learning',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mx-auto p-4">
      <h2>Learning Page</h2>
      <!-- Add your learning page content here -->
    </div>
  `
})
export class LearningComponent {}