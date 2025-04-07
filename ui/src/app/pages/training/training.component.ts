import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { TranslationResponse } from '../../services/models';
import { HeaderComponent } from '../../components/header/header.component';

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
  currentTranslation: TranslationResponse | null = null;
  verifiedTranslation = '';
  error = '';
  verificationSuccess = '';
  isTranslating = false;
  isVerifying = false;
  showRawResponse = false; // Toggle for showing/hiding raw response
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
        next: (response) => {
          this.currentTranslation = response;
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

    this.translationService.verify(this.sourceText, this.verifiedTranslation)
      .subscribe({
        next: (response) => {
          this.verificationSuccess = response.message;
          this.isVerifying = false;
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