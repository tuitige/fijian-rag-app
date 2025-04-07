import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService, TranslationResponse } from './translation.service';
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
  providers: [TranslationService],
  standalone: true
})
export class TrainingComponent {
  sourceText = '';
  sourceLanguage: 'en' | 'fj' = 'fj';
  currentTranslation: TranslationResponse | null = null;
  verifiedTranslation = '';
  error = '';
  
  verificationSuccess = '';
  isTranslating = false;
  isVerifying = false;
  showRawResponse = false; // Toggle for showing/hiding raw response

  constructor(private translationService: TranslationService) {}

  translateUsingClaude(): void {
    if (!this.sourceText.trim()) {
      this.error = 'Please enter some text to translate';
      return;
    }

    this.isTranslating = true;
    this.error = '';
    this.verificationSuccess = '';
    this.currentTranslation = null;
    this.verifiedTranslation = '';

    this.translationService.translate(this.sourceText, this.sourceLanguage)
    .subscribe({
      next: (response: TranslationResponse) => {
        this.currentTranslation = response;
        this.verifiedTranslation = response.translation;
        this.isTranslating = false;
        
        // Optional: Log additional information
        if (response.confidence) {
          console.log(`Translation confidence: ${response.confidence}`);
        }
        if (response.source === 'verified') {
          console.log('Using verified translation from database');
        }
      },
      error: (err: Error) => {
        console.error('Translation error:', err);
        this.error = 'Error translating text. Please try again.';
        this.isTranslating = false;
      }
    });
  }

  verifyTranslation(): void {
    if (!this.sourceText || !this.verifiedTranslation) {
      this.error = 'Both original text and verified translation are required';
      return;
    }
  
    this.isVerifying = true;
    this.error = '';
    this.verificationSuccess = '';
  
    this.translationService.verifyTranslation(this.sourceText, this.verifiedTranslation)
      .subscribe({
        next: (response) => {
          this.verificationSuccess = `Verification successful! ${response.message}`;
          this.isVerifying = false;
          // Optionally store the verification ID
          console.log('Verification ID:', response.id);
        },
        error: (err: Error) => {
          console.error('Verification error:', err);
          this.error = 'Error verifying translation. Please try again.';
          this.isVerifying = false;
        },
        complete: () => {
          this.isVerifying = false;
        }
      });
  }
}
