// src/app/training/training.component.ts
import { Component } from '@angular/core';
import { TranslationService, TranslationResponse } from '../../services/translation.service';

@Component({
  selector: 'app-training',
  template: `
    <div class="container mt-4">
      <div class="mb-3">
        <label for="fijianText" class="form-label">Fijian Text</label>
        <textarea 
          class="form-control" 
          id="fijianText" 
          rows="4"
          [(ngModel)]="fijianText"
          placeholder="Enter Fijian text here..."></textarea>
      </div>

      <button 
        class="btn btn-primary"
        (click)="translateUsingClaude()"
        [disabled]="isTranslating">
        {{ isTranslating ? 'Translating...' : 'Translate using Claude' }}
      </button>

      <div *ngIf="translation" class="mt-4">
        <h4>Translation:</h4>
        <div class="alert alert-info">
          {{ translation }}
        </div>
      </div>

      <div *ngIf="error" class="mt-4 alert alert-danger">
        {{ error }}
      </div>
    </div>
  `
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
