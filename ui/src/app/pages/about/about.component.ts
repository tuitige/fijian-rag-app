// src/app/pages/about/about.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mx-auto p-4">
      <h2>About Page</h2>
      <!-- Add your about page content here -->
    </div>
  `
})
export class AboutComponent {}
