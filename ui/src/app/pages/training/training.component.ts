import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { HeaderComponent } from '../../components/header/header.component';

interface Translation {
  translatedText: string;
  rawResponse: string;
  confidence?: number;
  id: string;
  similarTranslations: number;
  source?: 'claude' | 'verified';
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent
  ],
  providers: [],
  standalone: true
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
        next: (response: any) => {
          this.currentTranslation = {
            translatedText: response.translation,
            rawResponse: JSON.stringify(response, null, 2),
            id: Date.now().toString(),
            similarTranslations: 0,
            source: 'claude'
          };
          this.verifiedTranslation = response.translation;
          this.isTranslating = false;
        },
        error: (error) => {
          console.error('Translation error:', error);
          this.error = 'Failed to translate text. Please try again.';
          this.isTranslating = false;
        }
      });
  }

  verifyTranslation(): void {
    if (!this.sourceText || !this.verifiedTranslation) {
      this.error = 'Please provide both the original text and verified translation';
      return;
    }

    this.error = '';
    this.verificationSuccess = '';
    this.isVerifying = true;

    this.translationService.verify(this.sourceText, this.verifiedTranslation, this.sourceLanguage)
      .subscribe({
        next: (response) => {
          this.verificationSuccess = response.message;
          this.isVerifying = false;
          if (this.currentTranslation) {
            this.currentTranslation.source = 'verified';
          }
        },
        error: (error) => {
          console.error('Verification error:', error);
          this.error = 'Failed to verify translation. Please try again.';
          this.isVerifying = false;
        }
      });
  }

  toggleRawResponse(): void {
    this.showRawResponse = !this.showRawResponse;
  }
}
