import { Component } from '@angular/core';
import { TranslationService } from '../../services/translation.service';

interface TranslationResponse {
  id: string;
  translatedText: string;
  rawResponse?: string;
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.css']
})
export class TrainingComponent {
  sourceText: string = '';
  sourceLanguage: 'en' | 'fj' = 'fj';
  verifiedTranslation: string = '';
  currentTranslation: { id: string; translation: string; source: string; rawResponse?: string } | null = null;
  error: string = '';
  verificationSuccess: string = '';
  isVerifying: boolean = false;
  isTranslating: boolean = false;
  showRawResponse: boolean = false;

  constructor(private translationService: TranslationService) {}

  translate(): void {
    if (!this.sourceText.trim()) {
      this.error = 'Please enter a source text';
      return;
    }

    this.error = '';
    this.verificationSuccess = '';
    this.isTranslating = true;

    this.translationService.translate(this.sourceText, this.sourceLanguage).subscribe({
      next: (response: TranslationResponse) => {
        this.currentTranslation = {
          id: response.id,
          translation: response.translatedText,
          source: 'model',
          rawResponse: response.rawResponse
        };
        this.verifiedTranslation = response.translatedText;
        this.isTranslating = false;
      },
      error: (error: Error) => {
        console.error(error);
        this.error = 'Translation failed';
        this.isTranslating = false;
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
      next: () => {
        this.verificationSuccess = 'Translation verified and stored!';
        this.error = '';
        this.isVerifying = false;
        if (this.currentTranslation) {
          this.currentTranslation.source = 'verified';
        }
      },
      error: (error: Error) => {
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
