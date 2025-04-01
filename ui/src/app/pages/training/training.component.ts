// src/app/training/training.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService, TranslationResponse } from '../../services/translation.service';

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

              <div *ngIf="currentTranslation" class="mt-4">
                <h4 class="mb-3">Machine Translation:</h4>
                <div class="alert" [ngClass]="{
                  'alert-success': currentTranslation.confidence === 'high',
                  'alert-warning': currentTranslation.confidence === 'medium',
                  'alert-info': currentTranslation.confidence === 'low'
                }">
                  <p class="mb-2"><strong>Translation:</strong> {{ currentTranslation.translation }}</p>
                  <p class="mb-2"><strong>Confidence:</strong> {{ currentTranslation.confidence }}</p>
                  <p class="mb-0" *ngIf="currentTranslation.notes">
                    <strong>Notes:</strong> {{ currentTranslation.notes }}
                  </p>
                </div>

                <!-- New Verification Section -->
                <div class="mt-4">
                  <h4 class="mb-3">Verify Translation</h4>
                  <div class="mb-4">
                    <label for="verifiedTranslation" class="form-label">Edit Translation if needed</label>
                    <textarea 
                      class="form-control"
                      id="verifiedTranslation"
                      rows="4"
                      [(ngModel)]="verifiedTranslation"
                      placeholder="Edit the translation here..."
                    ></textarea>
                  </div>

                  <div class="d-grid gap-2">
                    <button 
                      class="btn btn-success btn-lg"
                      (click)="verifyTranslation()"
                      [disabled]="isVerifying">
                      <span *ngIf="isVerifying" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {{ isVerifying ? 'Verifying...' : 'Verify Translation' }}
                    </button>
                  </div>
                </div>
              </div>

              <div *ngIf="verificationSuccess" class="mt-4">
                <div class="alert alert-success">
                  <p class="mb-0">{{ verificationSuccess }}</p>
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

    .btn-success {
      background-color: #2ecc71;
      border-color: #2ecc71;
      transition: all 0.3s ease;
    }

    .btn-success:hover:not(:disabled) {
      background-color: #27ae60;
      border-color: #27ae60;
      transform: translateY(-1px);
    }

    .btn-success:disabled {
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

    .alert-success {
      background-color: #d4edda;
      border-color: #c3e6cb;
      color: #155724;
    }

    .alert-danger {
      background-color: #f8d7da;
      border-color: #f5c6cb;
      color: #721c24;
    }

    .alert-warning {
      background-color: #fff3cd;
      border-color: #ffeeba;
      color: #856404;
    }
  `]
})
export class TrainingComponent {
  fijianText = '';
  currentTranslation: TranslationResponse | null = null;
  verifiedTranslation = '';
  error = '';
  verificationSuccess = '';
  isTranslating = false;
  isVerifying = false;

  constructor(private translationService: TranslationService) {}

  translateUsingClaude(): void {
    if (!this.fijianText.trim()) {
      this.error = 'Please enter some text to translate';
      return;
    }

    this.isTranslating = true;
    this.error = '';
    this.verificationSuccess = '';
    this.currentTranslation = null;
    this.verifiedTranslation = '';

    this.translationService.translateText(this.fijianText)
      .subscribe({
        next: (response: TranslationResponse) => {
          this.currentTranslation = response;
          this.verifiedTranslation = response.translation; // Pre-populate the verification textarea
          this.isTranslating = false;
        },
        error: (err: Error) => {
          console.error('Translation error:', err);
          this.error = 'Error translating text. Please try again.';
          this.isTranslating = false;
        }
      });
  }

  verifyTranslation(): void {
    if (!this.fijianText || !this.verifiedTranslation) {
      this.error = 'Both original text and verified translation are required';
      return;
    }

    this.isVerifying = true;
    this.error = '';
    this.verificationSuccess = '';

    this.translationService.verifyTranslation(this.fijianText, this.verifiedTranslation)
      .subscribe({
        next: (response) => {
          this.verificationSuccess = response.message;
          this.isVerifying = false;
        },
        error: (err: Error) => {
          console.error('Verification error:', err);
          this.error = 'Error verifying translation. Please try again.';
          this.isVerifying = false;
        }
      });
  }
}
