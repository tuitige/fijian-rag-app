// src/app/training/training.component.ts
// src/app/training/training.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService, TranslationResponse } from '../../services/translation.service';

// In your training.component.ts
interface TranslationResponse {
  originalText: string;
  translation: string;
  confidence: string;
  notes: string;
  rawResponse?: string;
}

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card shadow">
            <div class="card-body">
              <h2 class="card-title mb-4">Fijian Text Translation</h2>
              
              <div class="mb-4">
                <label for="fijianText" class="form-label">Enter Fijian Text</label>
                <textarea 
                  class="form-control"
                  id="fijianText"
                  rows="4"
                  [(ngModel)]="fijianText"
                  placeholder="Enter Fijian text here..."
                  [class.is-invalid]="error"
                ></textarea>
              </div>

              <div class="d-grid gap-2">
                <button 
                  class="btn btn-primary btn-lg"
                  (click)="translateUsingClaude()"
                  [disabled]="isTranslating">
                  <span *ngIf="isTranslating" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {{ isTranslating ? 'Translating...' : 'Translate using Claude' }}
                </button>
              </div>

              <div *ngIf="translation" class="mt-4">
                <h4 class="mb-3">Translation:</h4>
                <div class="alert" [ngClass]="{'alert-success': confidence === 'high', 
                                              'alert-warning': confidence === 'medium',
                                              'alert-info': confidence === 'low'}">
                  <p class="mb-2"><strong>Translation:</strong> {{ translation }}</p>
                  <p class="mb-2"><strong>Confidence:</strong> {{ confidence }}</p>
                  <p class="mb-0" *ngIf="notes"><strong>Notes:</strong> {{ notes }}</p>
                </div>
              </div>

              <div *ngIf="error" class="mt-4">
                <div class="alert alert-danger">
                  <p class="mb-0">{{ error }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card {
      border-radius: 1rem;
      border: none;
    }
    
    .card-title {
      color: #2c3e50;
      font-weight: 600;
    }

    .form-label {
      font-weight: 500;
      color: #495057;
    }

    .btn-primary {
      background-color: #3498db;
      border-color: #3498db;
      transition: all 0.3s ease;
    }

    .btn-primary:hover:not(:disabled) {
      background-color: #2980b9;
      border-color: #2980b9;
      transform: translateY(-1px);
    }

    .btn-primary:disabled {
      background-color: #bdc3c7;
      border-color: #bdc3c7;
    }

    textarea.form-control {
      border: 2px solid #e9ecef;
      transition: border-color 0.3s ease;
    }

    textarea.form-control:focus {
      border-color: #3498db;
      box-shadow: 0 0 0 0.2rem rgba(52, 152, 219, 0.25);
    }

    .alert {
      border-radius: 0.5rem;
    }

    .alert-info {
      background-color: #e8f4f8;
      border-color: #d1ecf1;
      color: #0c5460;
    }

    .alert-danger {
      background-color: #f8d7da;
      border-color: #f5c6cb;
      color: #721c24;
    }
  `]
})

export class TrainingComponent {
  fijianText = '';
  translation = '';
  error = '';
  isTranslating = false;

  constructor(private translationService: TranslationService) {}

  translateUsingClaude(): void {
    if (!this.fijianText.trim()) {
      this.error = 'Please enter some text to translate';
      return;
    }

    this.isTranslating = true;
    this.error = '';
    this.translation = '';

    this.translationService.translateText(this.fijianText)
      .subscribe({
        next: (response: TranslationResponse) => {
          this.translation = response.translation;
          this.isTranslating = false;
        },
        error: (err: Error) => {
          console.error('Translation error:', err);
          this.error = 'Error translating text. Please try again.';
          this.isTranslating = false;
        }
      });
  }
}
