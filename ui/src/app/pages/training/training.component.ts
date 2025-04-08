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
  sourceText: string;
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
  similarTranslations: Translation[] = [];

  constructor(private translationService: ApiService) {}

  translateUsingClaude(): void {
    if (!this.sourceText.trim()) {
      this.error = 'Please enter some text to translate';
      return;
    }

    this.error = '';
    this.isTranslating = true;
    this.currentTranslation = null;
    this.similarTranslations = [];

    this.translationService.getSimilarTranslations(this.sourceText, this.sourceLanguage)
      .subscribe({
        next: (response) => {
          console.log('Similar translations response:', response);
          this.similarTranslations = response.translations;
          
          // If no similar translations found, proceed with new translation
          if (response.translations.length > 0) {
            console.log('Found similar translations:', this.similarTranslations);
            // Automatically use the first verified translation if available
            const verifiedTranslation = response.translations.find(t => t.source === 'verified');
            if (verifiedTranslation) {
              console.log('Using verified translation:', verifiedTranslation);
              this.useExistingTranslation(verifiedTranslation);
              this.isTranslating = false;
            } else {
              console.log('No verified translations found, proceeding with new translation');
              this.performNewTranslation();
            }
          } else {
            console.log('No similar translations found, proceeding with new translation');
            this.performNewTranslation();
          }
        },
        error: (error) => {
          console.error('Error checking similar translations:', error);
          this.performNewTranslation();
        }
      });
  }

  useExistingTranslation(translation: Translation): void {
    console.log('Using existing translation:', translation);
    this.currentTranslation = translation;
    this.verifiedTranslation = translation.translatedText;
    // Add a visual indicator that this is a verified translation
    this.verificationSuccess = 'Using verified translation';
  }

  private performNewTranslation(): void {
    this.translationService.translate(this.sourceText, this.sourceLanguage)
      .subscribe({
        next: (response: Translation) => {
          this.currentTranslation = {
            ...response,
            source: 'claude'
          };
          this.verifiedTranslation = response.translatedText;
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
