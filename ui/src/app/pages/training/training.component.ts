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
        console.log('Raw response:', response);
        
        // Parse the raw response to get just the translation
        let translationText: string;
        try {
          // If response.translatedText is already a string (not JSON), use it directly
          if (typeof response.translatedText === 'string' && !response.translatedText.startsWith('{')) {
            translationText = response.translatedText;
          } else {
            // If it's JSON, parse it and get the translation
            const parsedResponse = JSON.parse(response.translatedText);
            translationText = parsedResponse.translation;
          }
        } catch (e) {
          console.error('Error parsing translation:', e);
          translationText = response.translatedText; // Fallback to raw text
        }
  
        this.currentTranslation = {
          translatedText: translationText, // Use the extracted translation
          rawResponse: response.rawResponse,
          id: response.id,
          similarTranslations: response.similarTranslations,
          source: 'claude'
        };
        
        // Set the verified translation to just the translation text
        this.verifiedTranslation = translationText;
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
