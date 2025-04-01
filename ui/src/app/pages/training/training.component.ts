// src/app/pages/training/training.component.ts
import { Component } from '@angular/core';
import { TranslationService, TranslationResponse } from '../services/translation.service';

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.scss']
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
