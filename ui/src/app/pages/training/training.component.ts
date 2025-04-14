import { Component } from '@angular/core';
import { TranslationService, TranslateResponse } from '../../services/translation.service';

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.css']
})
export class TrainingComponent {
  sourceText: string = '';
  sourceLanguage: 'en' | 'fj' = 'fj';
  verifiedTranslation: string = '';
  verificationSuccess: string = '';
  error: string = '';
  isVerifying: boolean = false;
  isTranslating: boolean = false;
  showRawResponse: boolean = false;
  rawResponse: string = '';

  currentTranslation: {
    id: string;
    translation: string;
    source: string;
    rawResponse?: string;
  } | null = null;

  constructor(private translationService: TranslationService) {}

  translate(): void {
    if (!this.sourceText.trim()) {
      this.error = 'Please enter some source text.';
      return;
    }

    this.isTranslating = true;

    this.translationService.translate(this.sourceText, this.sourceLanguage).subscribe({
      next: (response: TranslateResponse) => {
        this.verifiedTranslation = response.translatedText;
        this.rawResponse = response.rawResponse || '';
        this.currentTranslation = {
          id: response.id,
          translation: response.translatedText,
          source: 'generated',
          rawResponse: response.rawResponse
        };
        this.verificationSuccess = '';
        this.error = '';
        this.isTranslating = false;
      },
      error: (err: any) => {
        this.isTranslating = false;
        this.error = 'Translation failed. Please try again.';
        this.verificationSuccess = '';
        console.error(err);
      }
    });
  }

  verifyTranslation(): void {
    if (!this.currentTranslation?.id) {
      this.error = 'Missing translation ID for verification';
      return;
    }

    this.isVerifying = true;
    this.translationService.verify(
      this.currentTranslation.id,
      this.sourceText,
      this.verifiedTranslation,
      this.sourceLanguage
    ).subscribe({
      next: (response) => {
        this.verificationSuccess = 'Translation verified and stored!';
        this.error = '';
        this.isVerifying = false;

        if (this.currentTranslation) {
          this.currentTranslation.source = 'verified';
        }
      },
      error: (error: any) => {
        this.error = 'Failed to verify translation. Please try again.';
        this.verificationSuccess = '';
        this.isVerifying = false;
        console.error(error);
      }
    });
  }

  toggleRawResponse(): void {
    this.showRawResponse = !this.showRawResponse;
  }
}
