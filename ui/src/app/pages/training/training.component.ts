
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { HeaderComponent } from '../../components/header/header.component';

interface Translation {
  id: string;
  translatedText: string;
  rawResponse: string;
  confidence?: number;
  similarTranslations: number;
  source?: 'claude' | 'verified';
  sourceLanguage?: 'en' | 'fj';
  sourceText: string;
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent
  ]
})
export class TrainingComponent {
  sourceText = '';
  currentTranslation: Translation | null = null;
  verifiedTranslation = '';
  error = '';
  verificationSuccess = '';
  isTranslating = false;
  isVerifying = false;
  showRawResponse = false;
  sourceLanguage: 'en' | 'fj' = 'fj';

  constructor(private translationService: ApiService) {}

  translateUsingClaude(): void {
    if (!this.sourceText.trim()) {
      this.error = 'Please enter some text to translate';
      return;
    }

    this.error = '';
    this.isTranslating = true;
    this.currentTranslation = null;

    this.translationService.translate(this.sourceText, this.sourceLanguage)
      .subscribe({
        next: (response: Translation) => {
          this.currentTranslation = {
            id: response.id,
            translatedText: response.translatedText,
            rawResponse: response.rawResponse,
            confidence: response.confidence,
            similarTranslations: response.similarTranslations,
            source: 'claude',
            sourceLanguage: this.sourceLanguage,
            sourceText: this.sourceText
          };
          this.verifiedTranslation = response.translatedText;
          this.isTranslating = false;
        },
        error: (err: any) => {
          this.error = 'Translation failed. Please try again.';
          this.isTranslating = false;
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
